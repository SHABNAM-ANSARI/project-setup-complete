// Parse CSV/XLSX files for both marks and students (dynamic fields).
import * as XLSX from "xlsx";
import type { ExtraFieldKey, PortalConfig } from "@/lib/portalConfig";
import { enabledExtraFields } from "@/lib/portalConfig";

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

export interface ParsedStudentRow {
  gr_no: string;
  name: string;
  class_name: string;
  roll_no: string | null;
  division: string | null;
  gender: string | null;
  extra: Record<string, string>;
  _row: number;
  _error?: string;
}

const REQ_MARKS = ["gr_no", "student_name", "subject", "term"];
const REQ_STUDENTS = ["gr_no", "name"];

// Normalize ANY header into snake_case: lower-case, collapse any run of
// non-alphanumeric chars (spaces, dashes, dots, multiple underscores) to a
// single underscore, trim leading/trailing underscores.
function normalizeKey(k: string): string {
  return String(k)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Map common header aliases the user might upload to our canonical keys.
// Strictly limited to columns that exist in the students table:
// gr_no, student_name/name, roll_no, class/class_name, division, gender, exam_year.
const STUDENT_ALIASES: Record<string, string> = {
  student_name: "name",
  full_name: "name",
  class: "class_name",
  std: "class_name",
  standard: "class_name",
  div: "division",
  sex: "gender",
  academic_year: "exam_year",
  year: "exam_year",
  session: "exam_year",
};

function applyAliases(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[STUDENT_ALIASES[k] ?? k] = v;
  }
  return out;
}

function readSheet(buf: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}

// Accept "I", "II", … "X", "Nur", "Jr KG", "Sr.KG", or already-canonical "Class 7".
const ROMAN: Record<string, number> = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10 };
export function canonicalizeClass(raw: string, fallback: string): string {
  const c = (raw || "").trim();
  if (!c) return fallback;
  const u = c.toUpperCase().replace(/\s+/g, " ");
  if (ROMAN[u]) return `Class ${ROMAN[u]}`;
  if (/^CLASS\s*\d+$/i.test(u)) return `Class ${u.replace(/\D/g, "")}`;
  if (/^(NUR|NURSERY)$/.test(u)) return "Nursery";
  if (/^JR[ .]?KG$/.test(u)) return "Jr.KG";
  if (/^SR[ .]?KG$/.test(u)) return "Sr.KG";
  return c;
}

export async function parseMarksFile(file: File, defaultClass: string): Promise<ParsedMarkRow[]> {
  const json = readSheet(await file.arrayBuffer());
  return json.map((rawRow, i) => {
    const raw: Record<string, string> = {};
    for (const k of Object.keys(rawRow)) raw[normalizeKey(k)] = String((rawRow as Record<string, unknown>)[k] ?? "").trim();
    const row = applyAliases(raw);
    const missing = REQ_MARKS.filter((k) => !row[k] && !(k === "student_name" && row.name));
    const out: ParsedMarkRow = {
      gr_no: row.gr_no || "",
      student_name: row.student_name || row.name || "",
      class_name: canonicalizeClass(row.class_name || "", defaultClass),
      term: row.term || "",
      subject: row.subject || "",
      marks: row.marks === "" || row.marks == null ? null : Number(row.marks),
      grade: row.grade ? row.grade.toUpperCase() : null,
      _row: i + 2,
    };
    if (missing.length) out._error = `Missing: ${missing.join(", ")}`;
    else if (out.marks !== null && (Number.isNaN(out.marks) || out.marks < 0 || out.marks > 100))
      out._error = "Marks must be 0–100";
    return out;
  });
}

export async function parseStudentsFile(
  file: File,
  defaultClass: string,
  cfg: PortalConfig,
): Promise<ParsedStudentRow[]> {
  const json = readSheet(await file.arrayBuffer());
  const enabled = enabledExtraFields(cfg).map((f) => f.key);
  return json.map((rawRow, i) => {
    const raw: Record<string, string> = {};
    for (const k of Object.keys(rawRow)) raw[normalizeKey(k)] = String((rawRow as Record<string, unknown>)[k] ?? "").trim();
    const row = applyAliases(raw);
    const missing = REQ_STUDENTS.filter((k) => !row[k]);
    const extra: Record<string, string> = {};
    for (const key of enabled) if (row[key]) extra[key] = row[key];
    if (row.exam_year) extra.exam_year = row.exam_year;
    const out: ParsedStudentRow = {
      gr_no: row.gr_no || "",
      name: (row.name || "").replace(/\s+/g, " ").trim().toUpperCase(),
      class_name: canonicalizeClass(row.class_name || "", defaultClass),
      roll_no: row.roll_no || null,
      division: row.division || null,
      gender: row.gender ? row.gender.toUpperCase().slice(0, 1) : null,
      extra,
      _row: i + 2,
    };
    if (missing.length) out._error = `Missing: ${missing.join(", ")}`;
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

export function downloadStudentsTemplate(cfg: PortalConfig) {
  const extraKeys = enabledExtraFields(cfg).map((f) => f.key) as ExtraFieldKey[];
  // Canonical headers requested by the spec — Roman numerals + "class" + "academic_year" also accepted.
  const headers = ["student_name", "roll_no", "gr_no", "class", "division", "gender", "exam_year", ...extraKeys];
  const sample = [
    ["JOHN DOE", "1", "1001", "I", "A", "M", "2026-27", ...extraKeys.map(() => "")],
    ["JANE DOE", "2", "1002", "Class 7", "B", "F", "2026-27", ...extraKeys.map(() => "")],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "students_template.xlsx");
}

