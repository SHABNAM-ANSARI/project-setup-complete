import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { exportClassExcel } from "@/lib/exporters";
import { getSubjectsForClass } from "@/data/subjectMapping";
import { calcResult, type MarkRow } from "@/lib/grades";
import jsPDF from "jspdf";

interface Props {
  className: string;
  term: string;
}

export function BulkExport({ className, term }: Props) {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);

  const fetchData = async () => {
    const [s, m] = await Promise.all([
      supabase
        .from("students")
        .select("gr_no,name,roll_no,division")
        .eq("class_name", className),
      supabase
        .from("marks")
        .select("gr_no,subject,marks,grade")
        .eq("class_name", className)
        .eq("term", term),
    ]);
    if (s.error) throw new Error(s.error.message);
    if (m.error) throw new Error(m.error.message);
    return { students: s.data || [], marks: m.data || [] };
  };

  const doExcel = async () => {
    setBusy("excel");
    try {
      const { students, marks } = await fetchData();
      if (!students.length) {
        toast.error("No students found in this class");
        return;
      }
      exportClassExcel({ className, term, students, marks });
      toast.success(`Exported ${students.length} students to Excel`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const doPdf = async () => {
    setBusy("pdf");
    try {
      const { students, marks } = await fetchData();
      if (!students.length) {
        toast.error("No students found in this class");
        return;
      }
      const subjects = getSubjectsForClass(className);
      const regulars = subjects.filter((s) => s.type === "regular");
      const credits = subjects.filter((s) => s.type === "credit");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();

      students
        .slice()
        .sort((a, b) =>
          (a.roll_no || a.gr_no || "").localeCompare(b.roll_no || b.gr_no || "", undefined, { numeric: true }),
        )
        .forEach((stu, idx) => {
          if (idx > 0) pdf.addPage();
          const studentMarks = marks.filter((m) => m.gr_no === stu.gr_no);
          const byKey: Record<string, MarkRow> = {};
          for (const mk of studentMarks) byKey[mk.subject] = mk;
          const summary = calcResult(subjects, byKey);

          pdf.setFontSize(16);
          pdf.setFont("helvetica", "bold");
          pdf.text("DUNNES HIGH SCHOOL — RESULT CARD", pageW / 2, 18, { align: "center" });

          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.text(`Class: ${className}`, 15, 30);
          pdf.text(`Term: ${term}`, pageW / 2, 30, { align: "center" });
          pdf.text(`GR No: ${stu.gr_no}`, pageW - 15, 30, { align: "right" });

          pdf.setFont("helvetica", "bold");
          pdf.text(`Name: ${stu.name}`, 15, 38);
          if (stu.roll_no) pdf.text(`Roll: ${stu.roll_no}`, pageW - 15, 38, { align: "right" });

          // Regular subjects table
          let y = 50;
          pdf.setFillColor(230, 230, 245);
          pdf.rect(15, y - 5, pageW - 30, 7, "F");
          pdf.setFontSize(10);
          pdf.text("Subject", 18, y);
          pdf.text("Marks", pageW - 60, y);
          pdf.text("Out Of", pageW - 35, y);
          y += 7;
          pdf.setFont("helvetica", "normal");
          regulars.forEach((sub) => {
            const mk = byKey[sub.name];
            pdf.text(sub.name, 18, y);
            pdf.text(String(mk?.marks ?? "—"), pageW - 60, y);
            pdf.text("100", pageW - 35, y);
            y += 6;
          });

          if (credits.length) {
            y += 4;
            pdf.setFont("helvetica", "bold");
            pdf.setFillColor(230, 245, 230);
            pdf.rect(15, y - 5, pageW - 30, 7, "F");
            pdf.text("Credit Subject", 18, y);
            pdf.text("Grade", pageW - 35, y);
            y += 7;
            pdf.setFont("helvetica", "normal");
            credits.forEach((sub) => {
              const mk = byKey[sub.name];
              pdf.text(sub.name, 18, y);
              pdf.text(mk?.grade || "—", pageW - 35, y);
              y += 6;
            });
          }

          y += 8;
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.text(`Total: ${summary.total} / ${summary.outOf}`, 18, y);
          pdf.text(`Percentage: ${summary.percentage}%`, pageW / 2 - 10, y);
          pdf.text(`Grade: ${summary.grade}`, pageW - 15, y, { align: "right" });
          y += 8;
          pdf.setTextColor(summary.passed ? 0 : 200, summary.passed ? 130 : 0, 0);
          pdf.text(`Result: ${summary.passed ? "PASS" : "FAIL"}`, 18, y);
          pdf.setTextColor(0, 0, 0);
        });

      pdf.save(`${className.replace(/\s+/g, "_")}_${term.replace(/\s+/g, "_")}_results.pdf`);
      toast.success(`Generated PDF for ${students.length} students`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card border-2 border-border rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-1">Bulk Class Results</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Download the entire class's results in one file. Totals, percentage, and grade are auto-calculated.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={doExcel}
          disabled={!!busy}
          className="bg-accent text-accent-foreground font-bold px-5 py-2.5 rounded-md hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {busy === "excel" ? "Building…" : "Class Excel"}
        </button>
        <button
          onClick={doPdf}
          disabled={!!busy}
          className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {busy === "pdf" ? "Building…" : "Class PDF"}
        </button>
        <span className="text-xs text-muted-foreground self-center inline-flex items-center gap-1">
          <Download className="w-3 h-3" /> Files download to your browser
        </span>
      </div>
    </div>
  );
}
