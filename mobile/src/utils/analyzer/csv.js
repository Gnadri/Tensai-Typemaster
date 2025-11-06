// src/utils/csv.js
export function toCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["ts", "level", "text", "score", "grade"].map(esc).join(",");
  const lines = rows.map(r => [
    new Date(r.ts).toISOString(), r.level, r.text, r.r.score, r.r.grade
  ].map(esc).join(","));
  return [header, ...lines].join("\n");
}