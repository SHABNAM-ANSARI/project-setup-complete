// Bulk class export — Excel + merged-PDF.
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSubjectsForClass } from "@/data/subjectMapping";
import { calcResult, type MarkRow } from "@/lib/grades";

export interface StudentForExport {
  gr_no: string;
  name: string;
  roll_no?: string | null;
  division?: string | null;
}

export interface MarkForExport {
  gr_no: string;
  subject: string;
  marks: number | null;
  grade: string | null;
}

export function exportClassExcel(opts: {
  className: string;
  term: string;
  students: StudentForExport[];
  marks: MarkForExport[];
}) {
  const { className, term, students, marks } = opts;
  const subjects = getSubjectsForClass(className);
  const regulars = subjects.filter((s) => s.type === "regular");
  const credits = subjects.filter((s) => s.type === "credit");

  const header = [
    "GR No",
    "Roll",
    "Student Name",
    ...regulars.map((s) => s.name),
    ...credits.map((s) => `${s.name} (Grade)`),
    "Total",
    "Out Of",
    "Percentage",
    "Grade",
    "Status",
  ];

  const rows = students
    .slice()
    .sort((a, b) => (a.roll_no || a.gr_no).localeCompare(b.roll_no || b.gr_no, undefined, { numeric: true }))
    .map((s) => {
      const studentMarks = marks.filter((m) => m.gr_no === s.gr_no);
      const byKey: Record<string, MarkRow> = {};
      for (const m of studentMarks) byKey[m.subject] = m;
      const summary = calcResult(subjects, byKey);
      return [
        s.gr_no,
        s.roll_no || "",
        s.name,
        ...regulars.map((sub) => byKey[sub.name]?.marks ?? ""),
        ...credits.map((sub) => byKey[sub.name]?.grade ?? ""),
        summary.total,
        summary.outOf,
        `${summary.percentage}%`,
        summary.grade,
        summary.passed ? "PASS" : "FAIL",
      ];
    });

  const meta = [
    [`Class: ${className}`, `Term: ${term}`, `Generated: ${new Date().toLocaleString()}`],
    [],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...meta, header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${className} ${term}`);
  XLSX.writeFile(wb, `${className.replace(/\s+/g, "_")}_${term.replace(/\s+/g, "_")}_results.xlsx`);
}

export async function exportClassPdfFromCardElement(opts: {
  cardEl: HTMLElement;
  fileName: string;
  iterate: (renderStudent: (grNo: string) => Promise<void>) => Promise<string[]>;
}) {
  const { cardEl, fileName, iterate } = opts;
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let first = true;

  await iterate(async (_grNo) => {
    const canvas = await html2canvas(cardEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    const imgW = pageW - 10;
    const imgH = (canvas.height * imgW) / canvas.width;
    if (!first) pdf.addPage();
    first = false;
    let y = 5;
    let remaining = imgH;
    if (imgH <= pageH - 10) {
      pdf.addImage(img, "JPEG", 5, y, imgW, imgH);
    } else {
      // single page scaled down
      const scaledH = pageH - 10;
      const scaledW = (canvas.width * scaledH) / canvas.height;
      pdf.addImage(img, "JPEG", (pageW - scaledW) / 2, 5, scaledW, scaledH);
    }
    void remaining;
  });

  pdf.save(fileName);
}
