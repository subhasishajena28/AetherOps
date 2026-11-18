import { Link } from "react-router-dom";
export function Mark() {
  return (
    <svg
      className="brand-mark"
      width="36"
      height="36"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 3 35 11.5V29L20 37 5 28.5V11.5L20 3Z"
        stroke="currentColor"
        strokeWidth="2.3"
      />
      <path
        d="m5 12 15 8.5L35 12M20 20.5V37M12 16l8-4.5 8 4.5M12 16v8.2l8 4.6 8-4.6V16"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path d="m12 24 8-4.6 8 4.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
export default function Brand() {
  return (
    <Link className="brand" to="/" aria-label="AetherOps home">
      <Mark />
      <span>
        Aether<span className="gold">Ops</span>
      </span>
    </Link>
  );
}
