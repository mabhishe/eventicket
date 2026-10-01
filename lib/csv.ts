/** CSV cell escaping (shared by report exports). */
export function cell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  // Guard against CSV formula injection.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a downloadable CSV response. */
export function csvResponse(
  filename: string,
  rows: (string | number | null | undefined)[][]
): Response {
  const body = "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
