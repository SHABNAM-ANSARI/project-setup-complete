// Parse CSV/XLSX files into a uniform marks-row shape.
import * as XLSX from "xlsx";

export interface ParsedMarkRow {
  gr_no: string;
  student_name: string;
  class_name: string;
  term: string;
  subject: string;
  marks: number | null;
  grade: string | null;
  _row: number;
  _error?: string;
}

const REQUIRED = ["gr_no", "student_name", "subject", "term"];

function normalizeKey(k: string): string {
  return String(k).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export async function parseMarksFile(
  file: File,
  defaultClass: string,
): Promise<ParsedMarkRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return json.map((rawRow, i) => {
    const row: Record<string, string> = {};
    for (const k of Object.keys(rawRow)) row[normalizeKey(k)] = String(rawRow[k] ?? "").trim();

    const missing = REQUIRED.filter((k) => !row[k]);
    const out: ParsedMarkRow = {
      gr_no: row.gr_no || "",
      student_name: row.student_name || row.name || "",
      class_name: row.class_name || row.class || defaultClass,
      term: row.term || "",
      subject: row.subject || "",
      marks: row.marks === "" ? null : Number(row.marks),
      grade: row.grade ? row.grade.toUpperCase() : null,
      _row: i + 2,
    };
    if (missing.length) out._error = `Missing: ${missing.join(", ")}`;
    else if (out.marks !== null && (Number.isNaN(out.marks) || out.marks < 0 || out.marks > 100))
      out._error = "Marks must be 0–100";
    return out;
  });
}

export function downloadTemplate() {
  const headers = ["gr_no", "student_name", "class_name", "term", "subject", "marks", "grade"];
  const sample = [
    ["1001", "JOHN DOE", "Class 7", "Term 1", "English", "82", ""],
    ["1001", "JOHN DOE", "Class 7", "Term 1", "Maths", "75", ""],
    ["1002", "JANE DOE", "Class 7", "Term 1", "Drawing", "", "A"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "marks_template.xlsx");
}
