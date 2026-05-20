// Bulk class export — Excel + branded jsPDF respecting portal configuration.
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { getSubjectsForClass } from "@/data/subjectMapping";
import { calcResult, type MarkRow } from "@/lib/grades";
import type { PortalConfig } from "@/lib/portalConfig";

export interface StudentForExport {
  gr_no: string;
  student_name: string;
  roll_no?: string | null;
  division?: string | null;
}

export interface MarkForExport {
  gr_no: string;
  subject: string;
  marks: number | null;
  grade: string | null;
  term?: string;
}

export function exportClassExcel(opts: {
  className: string;
  term: string;
  students: StudentForExport[];
  marks: MarkForExport[];
  config: PortalConfig;
}) {
  const { className, term, students, marks, config } = opts;
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
        s.student_name,
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
    [config.school.name],
    [config.school.address],
    [`Class: ${className}`, `Term: ${term}`, `Academic Year: ${config.school.academicYear}`, `Generated: ${new Date().toLocaleString()}`],
    [],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...meta, header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${className} ${term}`);
  XLSX.writeFile(wb, `${className.replace(/\s+/g, "_")}_${term.replace(/\s+/g, "_")}_results.xlsx`);
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface PdfStudent extends StudentForExport {}

export async function exportClassPdf(opts: {
  className: string;
  term: string;
  students: PdfStudent[];
  marks: MarkForExport[];
  config: PortalConfig;
}) {
  const { className, term, students, marks, config } = opts;
  const subjects = getSubjectsForClass(className);
  const regulars = subjects.filter((s) => s.type === "regular");
  const credits = subjects.filter((s) => s.type === "credit");
  const { orientation, template } = config.report;

  const pdf = new jsPDF(orientation === "landscape" ? "l" : "p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const logoData = await fetchImageDataUrl(config.school.logoUrl);
  const sigData = await fetchImageDataUrl(config.school.signatureUrl);

  const sorted = students.slice().sort((a, b) =>
    (a.roll_no || a.gr_no || "").localeCompare(b.roll_no || b.gr_no || "", undefined, { numeric: true }),
  );

  const drawHeader = (yStart = 10): number => {
    let y = yStart;
    if (logoData) {
      try { pdf.addImage(logoData, "PNG", 12, y, 16, 16); } catch { /* ignore */ }
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text(config.school.name, pageW / 2, y + 6, { align: "center" });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "italic");
    if (config.school.tagline) pdf.text(config.school.tagline, pageW / 2, y + 11, { align: "center" });
    pdf.setFont("helvetica", "normal");
    if (config.school.address) pdf.text(config.school.address, pageW / 2, y + 15, { align: "center" });
    pdf.setDrawColor(120);
    pdf.line(10, y + 19, pageW - 10, y + 19);
    return y + 23;
  };

  const drawFooterSignatures = (y: number) => {
    const cellW = (pageW - 30) / 3;
    pdf.setDrawColor(0);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    [0, 1, 2].forEach((i) => {
      const x = 15 + i * cellW;
      pdf.line(x, y, x + cellW - 5, y);
    });
    pdf.text("Class Teacher", 15 + cellW * 0.3, y + 5);
    pdf.text("Parent / Guardian", 15 + cellW + cellW * 0.2, y + 5);
    pdf.text(config.school.principalName || "Principal", 15 + 2 * cellW + cellW * 0.2, y + 5);
    if (sigData) {
      try { pdf.addImage(sigData, "PNG", 15 + 2 * cellW + 5, y - 14, 30, 12); } catch { /* ignore */ }
    }
  };

  const drawStudentMeta = (s: PdfStudent, y: number): number => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(`${s.student_name}`, 12, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`GR: ${s.gr_no}`, pageW - 60, y);
    pdf.text(`Roll: ${s.roll_no || "—"}`, pageW - 30, y);
    let yy = y + 5;
    pdf.text(`Class: ${className}    Term: ${term}    Year: ${config.school.academicYear}`, 12, yy);
    yy += 4;
    return yy + 2;
  };

  const renderStandard = (s: PdfStudent) => {
    const byKey: Record<string, MarkRow> = {};
    for (const m of marks.filter((m) => m.gr_no === s.gr_no)) byKey[m.subject] = m;
    const summary = calcResult(subjects, byKey);

    let y = drawHeader();
    y = drawStudentMeta(s, y);

    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(225, 230, 245);
    pdf.rect(12, y, pageW - 24, 6, "F");
    pdf.setFontSize(9);
    pdf.text("Subject", 14, y + 4);
    pdf.text("Marks", pageW - 50, y + 4);
    pdf.text("Out Of", pageW - 25, y + 4);
    y += 8;
    pdf.setFont("helvetica", "normal");
    regulars.forEach((sub) => {
      pdf.text(sub.name, 14, y);
      pdf.text(String(byKey[sub.name]?.marks ?? "—"), pageW - 50, y);
      pdf.text("100", pageW - 25, y);
      y += 5;
    });

    if (credits.length) {
      y += 3;
      pdf.setFont("helvetica", "bold");
      pdf.setFillColor(225, 245, 225);
      pdf.rect(12, y, pageW - 24, 6, "F");
      pdf.text("Co-Scholastic", 14, y + 4);
      pdf.text("Grade", pageW - 25, y + 4);
      y += 8;
      pdf.setFont("helvetica", "normal");
      credits.forEach((sub) => {
        pdf.text(sub.name, 14, y);
        pdf.text(byKey[sub.name]?.grade || "—", pageW - 25, y);
        y += 5;
      });
    }

    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(`Total: ${summary.total}/${summary.outOf}`, 14, y);
    pdf.text(`Percentage: ${summary.percentage}%`, pageW / 2 - 15, y);
    pdf.text(`Grade: ${summary.grade}`, pageW - 50, y);
    y += 6;
    pdf.setTextColor(summary.passed ? 0 : 200, summary.passed ? 130 : 0, 0);
    pdf.text(`Result: ${summary.passed ? "PASS" : "FAIL"}`, 14, y);
    pdf.setTextColor(0, 0, 0);

    drawFooterSignatures(pageH - 18);
  };

  const renderMultiTerm = (s: PdfStudent) => {
    const studentMarks = marks.filter((m) => m.gr_no === s.gr_no);
    const byTerm: Record<string, Record<string, MarkRow>> = { "Term 1": {}, "Term 2": {}, "Term 3": {} };
    for (const m of studentMarks) {
      const t = m.term || term;
      if (!byTerm[t]) byTerm[t] = {};
      byTerm[t][m.subject] = m;
    }

    let y = drawHeader();
    y = drawStudentMeta(s, y);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setFillColor(225, 230, 245);
    pdf.rect(12, y, pageW - 24, 6, "F");
    pdf.text("Subject", 14, y + 4);
    const colX = [pageW - 95, pageW - 70, pageW - 45, pageW - 20];
    ["Term 1", "Term 2", "Term 3", "Total"].forEach((h, i) => pdf.text(h, colX[i], y + 4));
    y += 8;
    pdf.setFont("helvetica", "normal");

    let grand = 0;
    let outOfAll = 0;
    regulars.forEach((sub) => {
      const t1 = Number(byTerm["Term 1"]?.[sub.name]?.marks) || 0;
      const t2 = Number(byTerm["Term 2"]?.[sub.name]?.marks) || 0;
      const t3 = Number(byTerm["Term 3"]?.[sub.name]?.marks) || 0;
      const total = t1 + t2 + t3;
      grand += total;
      outOfAll += 300;
      pdf.text(sub.name, 14, y);
      [t1, t2, t3, total].forEach((v, i) => pdf.text(String(v || "—"), colX[i], y));
      y += 5;
    });

    y += 3;
    const pct = outOfAll ? (grand / outOfAll) * 100 : 0;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Grand Total: ${grand}/${outOfAll}    Annual %: ${pct.toFixed(1)}%`, 14, y);
    drawFooterSignatures(pageH - 18);
  };

  const renderTriFold = (s: PdfStudent) => {
    const byKey: Record<string, MarkRow> = {};
    for (const m of marks.filter((m) => m.gr_no === s.gr_no)) byKey[m.subject] = m;
    const summary = calcResult(subjects, byKey);
    const panelW = pageW / 3;

    pdf.setDrawColor(180);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.line(panelW, 5, panelW, pageH - 5);
    pdf.line(panelW * 2, 5, panelW * 2, pageH - 5);
    pdf.setLineDashPattern([], 0);
    pdf.setDrawColor(0);

    if (logoData) { try { pdf.addImage(logoData, "PNG", panelW / 2 - 12, 25, 24, 24); } catch { /* */ } }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(config.school.name, panelW / 2, 60, { align: "center", maxWidth: panelW - 10 });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "italic");
    pdf.text(config.school.tagline, panelW / 2, 68, { align: "center", maxWidth: panelW - 10 });
    pdf.setFont("helvetica", "normal");
    pdf.text(config.school.address, panelW / 2, 74, { align: "center", maxWidth: panelW - 10 });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("PROGRESS REPORT", panelW / 2, 100, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(`Academic Year ${config.school.academicYear}`, panelW / 2, 108, { align: "center" });
    pdf.setFontSize(11);
    pdf.text(s.student_name, panelW / 2, 130, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`GR: ${s.gr_no}   Roll: ${s.roll_no || "—"}`, panelW / 2, 137, { align: "center" });
    pdf.text(`${className} · ${term}`, panelW / 2, 143, { align: "center" });

    let y = 15;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("SCHOLASTIC", panelW + panelW / 2, y, { align: "center" });
    y += 6;
    pdf.setFontSize(8);
    pdf.setFillColor(225, 230, 245);
    pdf.rect(panelW + 5, y, panelW - 10, 5, "F");
    pdf.text("Subject", panelW + 7, y + 3.5);
    pdf.text("Marks", panelW + panelW - 25, y + 3.5);
    y += 7;
    pdf.setFont("helvetica", "normal");
    regulars.forEach((sub) => {
      pdf.text(sub.name, panelW + 7, y, { maxWidth: panelW - 30 });
      pdf.text(String(byKey[sub.name]?.marks ?? "—"), panelW + panelW - 25, y);
      y += 5;
    });
    y += 3;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total: ${summary.total}/${summary.outOf}`, panelW + 7, y); y += 5;
    pdf.text(`Percentage: ${summary.percentage}%`, panelW + 7, y); y += 5;
    pdf.text(`Grade: ${summary.grade}`, panelW + 7, y); y += 5;
    pdf.setTextColor(summary.passed ? 0 : 200, summary.passed ? 130 : 0, 0);
    pdf.text(`Result: ${summary.passed ? "PASS" : "FAIL"}`, panelW + 7, y);
    pdf.setTextColor(0, 0, 0);

    let y3 = 15;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("CO-SCHOLASTIC", 2 * panelW + panelW / 2, y3, { align: "center" });
    y3 += 6;
    pdf.setFontSize(8);
    pdf.setFillColor(225, 245, 225);
    pdf.rect(2 * panelW + 5, y3, panelW - 10, 5, "F");
    pdf.text("Subject", 2 * panelW + 7, y3 + 3.5);
    pdf.text("Grade", 2 * panelW + panelW - 20, y3 + 3.5);
    y3 += 7;
    pdf.setFont("helvetica", "normal");
    credits.forEach((sub) => {
      pdf.text(sub.name, 2 * panelW + 7, y3, { maxWidth: panelW - 30 });
      pdf.text(byKey[sub.name]?.grade || "—", 2 * panelW + panelW - 20, y3);
      y3 += 5;
    });
    const sy = pageH - 30;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.line(2 * panelW + 8, sy, 2 * panelW + panelW - 8, sy);
    if (sigData) { try { pdf.addImage(sigData, "PNG", 2 * panelW + panelW / 2 - 15, sy - 12, 30, 10); } catch { /* */ } }
    pdf.text(config.school.principalName || "Principal", 2 * panelW + panelW / 2, sy + 5, { align: "center" });
  };

  const render = template === "multi_term" ? renderMultiTerm
              : template === "tri_fold"   ? renderTriFold
              : renderStandard;

  sorted.forEach((stu, idx) => {
    if (idx > 0) pdf.addPage();
    render(stu);
  });

  pdf.save(`${className.replace(/\s+/g, "_")}_${term.replace(/\s+/g, "_")}_${template}.pdf`);
}
