// Derived from Subject_Maping-3.csv with strict per-class filtering.
// Regular = numeric (out of 100). Credit = grade-only (A+ … D).

export type SubjectType = "regular" | "credit";

export interface SubjectDef {
  name: string;
  type: SubjectType;
}

export const GRADE_OPTIONS = ["A+", "A", "B", "C", "D"] as const;
export type GradeValue = (typeof GRADE_OPTIONS)[number];

export const PASSING_MARKS = 35;
export const MAX_MARKS = 100;

// --- Subject sets per class (strictly filtered) ---

// Nursery: only foundational
const NURSERY: SubjectDef[] = [
  { name: "English", type: "regular" },
  { name: "Maths", type: "regular" },
  { name: "EVS", type: "regular" },
  { name: "Handwriting", type: "regular" },
  { name: "Drawing", type: "credit" },
  { name: "Music", type: "credit" },
  { name: "P.T.", type: "credit" },
  { name: "SUPW", type: "credit" },
];

// Jr.KG / Sr.KG
const KG: SubjectDef[] = [
  { name: "English", type: "regular" },
  { name: "Hindi", type: "regular" },
  { name: "Marathi", type: "regular" },
  { name: "Maths", type: "regular" },
  { name: "EVS", type: "regular" },
  { name: "GK", type: "regular" },
  { name: "Handwriting", type: "regular" },
  { name: "Drawing", type: "credit" },
  { name: "Music", type: "credit" },
  { name: "P.T.", type: "credit" },
  { name: "SUPW", type: "credit" },
  { name: "Value Education", type: "credit" },
];

// Class 1 – 5 (primary): include GK + Handwriting
const PRIMARY: SubjectDef[] = [
  { name: "English", type: "regular" },
  { name: "Hindi", type: "regular" },
  { name: "Marathi", type: "regular" },
  { name: "Maths", type: "regular" },
  { name: "Science", type: "regular" },
  { name: "Social Studies", type: "regular" },
  { name: "GK", type: "regular" },
  { name: "Handwriting", type: "regular" },
  { name: "Computer", type: "regular" },
  { name: "Drawing", type: "credit" },
  { name: "Music", type: "credit" },
  { name: "P.T.", type: "credit" },
  { name: "SUPW", type: "credit" },
  { name: "Value Education", type: "credit" },
];

// Class 6 – 8 (middle): drop GK + Handwriting, add Geography/Economics split
const MIDDLE: SubjectDef[] = [
  { name: "English", type: "regular" },
  { name: "Hindi", type: "regular" },
  { name: "Marathi", type: "regular" },
  { name: "Maths", type: "regular" },
  { name: "Science", type: "regular" },
  { name: "History & Civics", type: "regular" },
  { name: "Geography", type: "regular" },
  { name: "Computer", type: "regular" },
  { name: "Drawing", type: "credit" },
  { name: "P.T.", type: "credit" },
  { name: "SUPW", type: "credit" },
  { name: "Value Education", type: "credit" },
];

// Class 9 – 10 (secondary): add Economics
const SECONDARY: SubjectDef[] = [
  { name: "English", type: "regular" },
  { name: "Hindi", type: "regular" },
  { name: "Marathi", type: "regular" },
  { name: "Maths", type: "regular" },
  { name: "Science", type: "regular" },
  { name: "History & Civics", type: "regular" },
  { name: "Geography", type: "regular" },
  { name: "Economics", type: "regular" },
  { name: "Computer", type: "regular" },
  { name: "P.T.", type: "credit" },
  { name: "SUPW", type: "credit" },
  { name: "Value Education", type: "credit" },
];

export const SUBJECT_MAP: Record<string, SubjectDef[]> = {
  Nursery: NURSERY,
  "Jr.KG": KG,
  "Sr.KG": KG,
  "Class 1": PRIMARY,
  "Class 2": PRIMARY,
  "Class 3": PRIMARY,
  "Class 4": PRIMARY,
  "Class 5": PRIMARY,
  "Class 6": MIDDLE,
  "Class 7": MIDDLE,
  "Class 8": MIDDLE,
  "Class 9": SECONDARY,
  "Class 10": SECONDARY,
};

export const getSubjectsForClass = (className: string): SubjectDef[] =>
  SUBJECT_MAP[className] ?? PRIMARY;

export const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"] as const;

// --- Calculation helpers (single source of truth) ---

export const computeTotal = (
  marks: Record<string, number>,
  regularSubjects: SubjectDef[],
): number =>
  regularSubjects.reduce((sum, s) => {
    const v = Number(marks[s.name]);
    return sum + (Number.isFinite(v) ? Math.max(0, Math.min(MAX_MARKS, v)) : 0);
  }, 0);

export const computeMaxTotal = (regularSubjects: SubjectDef[]): number =>
  regularSubjects.length * MAX_MARKS;

export const computePercentage = (
  marks: Record<string, number>,
  regularSubjects: SubjectDef[],
): number => {
  const max = computeMaxTotal(regularSubjects);
  if (max === 0) return 0;
  return (computeTotal(marks, regularSubjects) / max) * 100;
};

export const isSubjectPass = (mark: number): boolean => mark >= PASSING_MARKS;

export const getOverallResult = (
  marks: Record<string, number>,
  regularSubjects: SubjectDef[],
): "PASS" | "FAIL" => {
  const anyFail = regularSubjects.some((s) => {
    const v = Number(marks[s.name]) || 0;
    return v < PASSING_MARKS;
  });
  return anyFail ? "FAIL" : "PASS";
};
