export type Finding = {
  id: string;
  engine: string;
  rule: string;
  title: string;
  severity: "High" | "Medium" | "Low";
  file: string;
  line: number;
  explanation: string;
  fix: string;
  pattern: string;
};
export type Engine = {
  name: string;
  version: string;
  status: string;
  count: number;
  note: string;
};
export type Scan = {
  id: string;
  project: string;
  created_at: string;
  status: string;
  files: number;
  duration: number;
  engines: Engine[];
  findings: Finding[];
  triage: Record<string, string>;
  origin: string;
  sample?: string;
  sha256: string;
  description?: string;
  skipped: number;
};
export const formatDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
