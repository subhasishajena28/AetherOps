FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --create-home --uid 10001 aether
COPY backend/requirements.txt backend/requirements.lock /app/backend/
RUN pip install -r backend/requirements.txt -c backend/requirements.lock && pip check
COPY backend /app/backend
COPY public/data /app/public/data
USER 10001:10001
RUN python -c "from backend.scanner import analyze, sample_zip; r=analyze(sample_zip('vulnerable-demo'),'image-smoke'); assert r['status']=='Complete' and all(e['count']>0 for e in r['engines']), r['engines']"
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --limit-concurrency 20 --timeout-keep-alive 5 --no-access-log"]
