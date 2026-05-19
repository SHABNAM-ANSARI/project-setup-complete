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
  dateofbirth: "dob",
  date_of_birth: "dob",
  birthdate: "dob",
  phone: "contact",
  mobile: "contact",
  parent: "parent_name",
  guardian: "parent_name",
};

function applyAliases(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[STUDENT_ALIASES[k] ?? k] = v;
  }
  return out;
}


export async function parseMarksFile(file: File, defaultClass: string): Promise<ParsedMarkRow[]> {
  const json = readSheet(await file.arrayBuffer());
  return json.map((rawRow, i) => {
    const row: Record<string, string> = {};
    for (const k of Object.keys(rawRow)) row[normalizeKey(k)] = String(rawRow[k] ?? "").trim();
    const missing = REQ_MARKS.filter((k) => !row[k]);
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

export async function parseStudentsFile(
  file: File,
  defaultClass: string,
  cfg: PortalConfig,
): Promise<ParsedStudentRow[]> {
  const json = readSheet(await file.arrayBuffer());
  const enabled = enabledExtraFields(cfg).map((f) => f.key);
  return json.map((rawRow, i) => {
    const row: Record<string, string> = {};
    for (const k of Object.keys(rawRow)) row[normalizeKey(k)] = String(rawRow[k] ?? "").trim();
    const missing = REQ_STUDENTS.filter((k) => !row[k]);
    const extra: Record<string, string> = {};
    for (const key of enabled) if (row[key]) extra[key] = row[key];
    const out: ParsedStudentRow = {
      gr_no: row.gr_no || "",
      name: (row.name || "").toUpperCase(),
      class_name: row.class_name || row.class || defaultClass,
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
  const headers = ["gr_no", "name", "class_name", "roll_no", "division", "gender", ...extraKeys];
  const sample = [
    ["1001", "JOHN DOE", "Class 7", "1", "A", "M", ...extraKeys.map(() => "")],
    ["1002", "JANE DOE", "Class 7", "2", "A", "F", ...extraKeys.map(() => "")],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "students_template.xlsx");
}
