import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { exportClassExcel, exportClassPdf } from "@/lib/exporters";
import { usePortalConfig } from "@/lib/portalConfig";

interface Props {
  className: string;
  term: string;
}

export function BulkExport({ className, term }: Props) {
  const { config } = usePortalConfig();
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);

  const fetchData = async (allTerms: boolean) => {
    const studentsQ = supabase
      .from("students")
      .select("gr_no,student_name,roll_no,division")
      .eq("class", className);
    const marksQ = allTerms
      ? supabase.from("marks").select("gr_no,subject,marks,grade,term").eq("class", className)
      : supabase
          .from("marks")
          .select("gr_no,subject,marks,grade,term")
          .eq("class", className)
          .eq("term", term);
    const [s, m] = await Promise.all([studentsQ, marksQ]);
    if (s.error) throw new Error(s.error.message);
    if (m.error) throw new Error(m.error.message);
    return { students: s.data || [], marks: m.data || [] };
  };

  const doExcel = async () => {
    setBusy("excel");
    try {
      const { students, marks } = await fetchData(false);
      if (!students.length) return toast.error("No students found in this class");
      exportClassExcel({ className, term, students, marks, config });
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
      const allTerms = config.report.template === "multi_term";
      const { students, marks } = await fetchData(allTerms);
      if (!students.length) return toast.error("No students found in this class");
      await exportClassPdf({ className, term, students, marks, config });
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
      <p className="text-sm text-muted-foreground mb-2">
        Download the entire class's results in one file. Totals, percentage, and grade are auto-calculated.
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        PDF layout: <strong className="text-foreground capitalize">{config.report.orientation}</strong> ·
        template <strong className="text-foreground">{config.report.template.replace("_", " ")}</strong>
        · branded as <strong className="text-foreground">{config.school.name}</strong>
        <span className="opacity-75"> (change in Configuration)</span>
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
