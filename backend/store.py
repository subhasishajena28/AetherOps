"""Local SQLAlchemy Core store (no ORM). Hosted PostgreSQL uses the Vercel gateway."""

from pathlib import Path
import os
import hashlib
import secrets
import hmac
import time
import uuid
from sqlalchemy import (
    create_engine,
    MetaData,
    Table,
    Column,
    String,
    Text,
    Integer,
    JSON,
    select,
    insert,
    delete,
    update,
    func,
)
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


class LocalStore:
    def __init__(self, url):
        if not url.startswith("sqlite:"):
            raise RuntimeError(
                "For managed PostgreSQL use STORAGE_MODE=gateway; never expose DB credentials to a browser."
            )
        self.engine = create_engine(
            url, connect_args={"check_same_thread": False, "timeout": 8}
        )
        m = MetaData()
        self.users = Table(
            "users",
            m,
            Column("id", String(36), primary_key=True),
            Column("email", String(254), unique=True, nullable=False),
            Column("password_hash", Text, nullable=False),
        )
        self.sessions = Table(
            "sessions",
            m,
            Column("digest", String(64), primary_key=True),
            Column("user_id", String(36), nullable=False, index=True),
            Column("expires", Integer, nullable=False),
        )
        self.scans = Table(
            "scans",
            m,
            Column("id", String(36), primary_key=True),
            Column("user_id", String(36), index=True, nullable=False),
            Column("created_at", String(40)),
            Column("report", JSON, nullable=False),
            Column("triage", JSON, nullable=False),
        )
        m.create_all(self.engine)

    @staticmethod
    def _hash(p, salt):
        return hashlib.scrypt(
            p.encode(),
            salt=bytes.fromhex(salt),
            n=2**15,
            r=8,
            p=1,
            maxmem=80 * 1024 * 1024,
        ).hex()

    def auth(self, email, password, signup=False):
        u = self.users
        email = email.strip().lower()
        with self.engine.begin() as c:
            if signup:
                salt = secrets.token_hex(16)
                uid = str(uuid.uuid4())
                try:
                    c.execute(
                        insert(u).values(
                            id=uid,
                            email=email,
                            password_hash=salt + ":" + self._hash(password, salt),
                        )
                    )
                except IntegrityError:
                    raise HTTPException(
                        409, "Account could not be created. Try signing in."
                    )
            else:
                row = c.execute(select(u).where(u.c.email == email)).mappings().first()
                salt, hashed = (
                    row["password_hash"] if row else "a1" * 16 + ":" + "0" * 128
                ).split(":")
                compare = hmac.compare_digest(self._hash(password, salt), hashed)
                if not row or not compare:
                    raise HTTPException(401, "Invalid email or password.")
                uid = row["id"]
            t = secrets.token_urlsafe(40)
            c.execute(
                delete(self.sessions).where(self.sessions.c.expires < int(time.time()))
            )
            c.execute(
                insert(self.sessions).values(
                    digest=hashlib.sha256(t.encode()).hexdigest(),
                    user_id=uid,
                    expires=int(time.time()) + 8 * 3600,
                )
            )
            return {"token": t, "email": email}

    def user(self, t):
        s, u = self.sessions, self.users
        with self.engine.connect() as c:
            r = (
                c.execute(
                    select(u.c.id, u.c.email)
                    .select_from(s.join(u, s.c.user_id == u.c.id))
                    .where(
                        s.c.digest == hashlib.sha256(t.encode()).hexdigest(),
                        s.c.expires > int(time.time()),
                    )
                )
                .mappings()
                .first()
            )
            if not r:
                raise HTTPException(401, "Session expired. Sign in again.")
            return dict(r)

    def logout(self, t):
        with self.engine.begin() as c:
            c.execute(
                delete(self.sessions).where(
                    self.sessions.c.digest == hashlib.sha256(t.encode()).hexdigest()
                )
            )

    def save(self, uid, r):
        s = self.scans
        with self.engine.begin() as c:
            if (
                c.scalar(select(func.count()).select_from(s).where(s.c.user_id == uid))
                >= 100
            ):
                raise HTTPException(409, "Workspace limit: remove an older scan first.")
            c.execute(
                insert(s).values(
                    id=r["id"],
                    user_id=uid,
                    created_at=r["created_at"],
                    report=r,
                    triage={},
                )
            )
        return r

    def list(self, uid):
        s = self.scans
        with self.engine.connect() as c:
            return [
                dict(r.report, triage=r.triage)
                for r in c.execute(
                    select(s)
                    .where(s.c.user_id == uid)
                    .order_by(s.c.created_at.desc())
                    .limit(100)
                )
            ]

    def get(self, uid, id):
        s = self.scans
        with self.engine.connect() as c:
            r = c.execute(select(s).where(s.c.user_id == uid, s.c.id == id)).first()
            if not r:
                raise HTTPException(404, "Scan not found.")
            return dict(r.report, triage=r.triage)

    def remove(self, uid, id):
        with self.engine.begin() as c:
            if not c.execute(
                delete(self.scans).where(
                    self.scans.c.user_id == uid, self.scans.c.id == id
                )
            ).rowcount:
                raise HTTPException(404, "Scan not found.")

    def triage(self, uid, id, finding, status):
        r = self.get(uid, id)
        if not any(f["id"] == finding for f in r["findings"]):
            raise HTTPException(404, "Finding not found.")
        with self.engine.begin() as c:
            result = c.execute(
                update(self.scans)
                .where(
                    self.scans.c.user_id == uid,
                    self.scans.c.id == id,
                    self.scans.c.triage == r["triage"],
                )
                .values(triage={**r["triage"], finding: status})
            )
            if result.rowcount != 1:
                raise HTTPException(409, "Scan changed. Refresh and try again.")


def open_local_store():
    path = Path(os.getenv("LOCAL_DATA_DIR", str(Path.home() / ".aetherops")))
    path.mkdir(mode=0o700, exist_ok=True, parents=True)
    return LocalStore(
        os.getenv("DATABASE_URL", "sqlite:///" + str(path / "aetherops.sqlite3"))
    )
