// Centralized result calculator + grade scale.
import type { SubjectDef } from "@/data/subjectMapping";
import { GRADE_OPTIONS, type GradeValue } from "@/data/subjectMapping";

export interface MarkRow {
  subject: string;
  marks: number | null;
  grade: string | null;
}

export interface ResultSummary {
  total: number;
  outOf: number;
  percentage: number;
  grade: string;
  passed: boolean;
}

export const PASSING_PERCENTAGE = 35;

export function gradeFromPercent(p: number): string {
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B+";
  if (p >= 60) return "B";
  if (p >= 50) return "C+";
  if (p >= 40) return "C";
  if (p >= 33) return "D";
  return "F";
}

export function calcResult(
  subjects: SubjectDef[],
  marksByKey: Record<string, MarkRow | undefined>,
): ResultSummary {
  const regulars = subjects.filter((s) => s.type === "regular");
  let total = 0;
  let outOf = 0;
  let allPass = true;
  for (const s of regulars) {
    const row = marksByKey[s.name];
    const m = typeof row?.marks === "number" ? row.marks : 0;
    total += m;
    outOf += 100;
    if (m < 35) allPass = false;
  }
  const percentage = outOf > 0 ? (total / outOf) * 100 : 0;
  return {
    total,
    outOf,
    percentage: Math.round(percentage * 100) / 100,
    grade: allPass ? gradeFromPercent(percentage) : "F",
    passed: allPass,
  };
}

export const VALID_GRADE_LETTERS: ReadonlyArray<GradeValue> = GRADE_OPTIONS;
