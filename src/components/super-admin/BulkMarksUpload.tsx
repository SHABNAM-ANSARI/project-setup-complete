import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileDown, FileSpreadsheet, AlertTriangle, Users, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  parseMarksFile,
  parseStudentsFile,
  downloadTemplate,
  downloadStudentsTemplate,
  type ParsedMarkRow,
  type ParsedStudentRow,
} from "@/lib/marksParser";
import { usePortalConfig, enabledExtraFields } from "@/lib/portalConfig";

interface Props {
  defaultClass: string;
  onImported?: () => void;
}

type Mode = "marks" | "students";

export function BulkMarksUpload({ defaultClass, onImported }: Props) {
  const { config } = usePortalConfig();
  const [mode, setMode] = useState<Mode>("marks");
  const [markRows, setMarkRows] = useState<ParsedMarkRow[]>([]);
  const [studentRows, setStudentRows] = useState<ParsedStudentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMarkRows([]);
    setStudentRows([]);
    setFile(null);
  };

  const onFile = async (f: File) => {
    setFile(f);
    try {
      if (mode === "marks") {
        const parsed = await parseMarksFile(f, defaultClass);
        setMarkRows(parsed);
        setStudentRows([]);
        toast.success(`Parsed ${parsed.length} mark rows from ${f.name}`);
      } else {
        const parsed = await parseStudentsFile(f, defaultClass);
        setStudentRows(parsed);
        setMarkRows([]);
        toast.success(`Parsed ${parsed.length} student rows from ${f.name}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const rows = mode === "marks" ? markRows : studentRows;
  const validRows = rows.filter((r) => !r._error);
  const errorRows = rows.filter((r) => r._error);

  const importNow = async () => {
    if (!validRows.length) return toast.error("Nothing to import");
    setBusy(true);
    try {
      if (mode === "marks") {
        const payload = (validRows as ParsedMarkRow[]).map((r) => ({
          gr_no: r.gr_no,
          student_name: r.student_name,
          class: r.class,
          term: r.term,
          subject: r.subject,
          marks: r.marks,
          grade: r.grade,
          updated_at: new Date().toISOString(),
        }));
        for (let i = 0; i < payload.length; i += 200) {
          const { error } = await supabase.from("marks").upsert(payload.slice(i, i + 200));
          if (error) throw error;
        }
        toast.success(`Imported ${payload.length} marks`);
      } else {
        const payload = (validRows as ParsedStudentRow[]).map((r) => ({
          gr_no: r.gr_no,
          student_name: r.student_name,
          class: r.class,
          roll_no: r.roll_no,
          division: r.division,
          gender: r.gender,
          exam_year: r.exam_year,
          updated_at: new Date().toISOString(),
        }));
        for (let i = 0; i < payload.length; i += 200) {
          const { error } = await supabase
            .from("students")
            .upsert(payload.slice(i, i + 200) as never, { onConflict: "gr_no,class" });
          if (error) throw error;
        }
        toast.success(`Imported ${payload.length} students`);
      }
      reset();
      onImported?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const extraCols = enabledExtraFields(config);

  return (
    <div className="space-y-4">
      <div className="bg-card border-2 border-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">Bulk Upload</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "marks"
                ? <>Required columns: <code className="font-mono">gr_no, student_name, subject, term, marks</code> (or <code className="font-mono">grade</code> for credit subjects).</>
                : <>Required: <code className="font-mono">gr_no, name</code>. Optional dynamic fields are controlled in Configuration: {extraCols.length ? extraCols.map(f => <code key={f.key} className="font-mono mx-1">{f.key}</code>) : <em>none enabled</em>}.</>
              }
            </p>
          </div>
          <button
            onClick={() => (mode === "marks" ? downloadTemplate() : downloadStudentsTemplate())}
            className="text-sm font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" /> Template
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode("marks"); reset(); }}
            className={`px-3 py-1.5 rounded-md text-sm font-bold inline-flex items-center gap-1 ${mode === "marks" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            <BookOpen className="w-4 h-4" /> Marks
          </button>
          <button
            onClick={() => { setMode("students"); reset(); }}
            className={`px-3 py-1.5 rounded-md text-sm font-bold inline-flex items-center gap-1 ${mode === "students" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            <Users className="w-4 h-4" /> Students
          </button>
        </div>

        <label className="block">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <div className="border-2 border-dashed border-primary/40 rounded-lg p-8 text-center hover:bg-primary/5 cursor-pointer">
            <Upload className="w-8 h-8 mx-auto text-primary mb-2" />
            <div className="font-bold text-foreground">Click to choose CSV/Excel</div>
            <div className="text-xs text-muted-foreground mt-1">{file ? file.name : "No file selected"}</div>
          </div>
        </label>
      </div>

      {rows.length > 0 && (
        <div className="bg-card border-2 border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span className="font-bold">
                {validRows.length} valid · {errorRows.length} errors
              </span>
            </div>
            <button
              onClick={importNow}
              disabled={busy || !validRows.length}
              className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Importing…" : `Import ${validRows.length} rows`}
            </button>
          </div>

          {errorRows.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 mb-4 text-sm">
              <div className="flex items-center gap-2 font-bold text-destructive mb-2">
                <AlertTriangle className="w-4 h-4" /> {errorRows.length} rows skipped
              </div>
              <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                {errorRows.slice(0, 20).map((r) => (
                  <li key={r._row}>Row {r._row}: {r._error}</li>
                ))}
                {errorRows.length > 20 && <li>…and {errorRows.length - 20} more</li>}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto max-h-80">
            {mode === "marks" ? (
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">Row</th>
                    <th className="text-left px-2 py-1">GR No</th>
                    <th className="text-left px-2 py-1">Name</th>
                    <th className="text-left px-2 py-1">Class</th>
                    <th className="text-left px-2 py-1">Term</th>
                    <th className="text-left px-2 py-1">Subject</th>
                    <th className="text-right px-2 py-1">Marks</th>
                    <th className="text-center px-2 py-1">Grade</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {markRows.slice(0, 200).map((r) => (
                    <tr key={r._row} className={`border-t border-border ${r._error ? "bg-destructive/5" : ""}`}>
                      <td className="px-2 py-1 font-mono">{r._row}</td>
                      <td className="px-2 py-1">{r.gr_no}</td>
                      <td className="px-2 py-1">{r.student_name}</td>
                      <td className="px-2 py-1">{r.class}</td>
                      <td className="px-2 py-1">{r.term}</td>
                      <td className="px-2 py-1">{r.subject}</td>
                      <td className="px-2 py-1 text-right">{r.marks ?? ""}</td>
                      <td className="px-2 py-1 text-center">{r.grade ?? ""}</td>
                      <td className="px-2 py-1">{r._error ? <span className="text-destructive">{r._error}</span> : <span className="text-accent">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">Row</th>
                    <th className="text-left px-2 py-1">GR</th>
                    <th className="text-left px-2 py-1">Name</th>
                    <th className="text-left px-2 py-1">Class</th>
                    <th className="text-left px-2 py-1">Roll</th>
                    <th className="text-left px-2 py-1">Div</th>
                    <th className="text-left px-2 py-1">Gender</th>
                    {extraCols.map((c) => (
                      <th key={c.key} className="text-left px-2 py-1">{c.label}</th>
                    ))}
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.slice(0, 200).map((r) => (
                    <tr key={r._row} className={`border-t border-border ${r._error ? "bg-destructive/5" : ""}`}>
                      <td className="px-2 py-1 font-mono">{r._row}</td>
                      <td className="px-2 py-1">{r.gr_no}</td>
                      <td className="px-2 py-1">{r.student_name}</td>
                      <td className="px-2 py-1">{r.class}</td>
                      <td className="px-2 py-1">{r.roll_no || ""}</td>
                      <td className="px-2 py-1">{r.division || ""}</td>
                      <td className="px-2 py-1">{r.gender || ""}</td>
                      {extraCols.map((c) => (
                        <td key={c.key} className="px-2 py-1">{""}</td>
                      ))}
                      <td className="px-2 py-1">{r._error ? <span className="text-destructive">{r._error}</span> : <span className="text-accent">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {rows.length > 200 && (
              <p className="text-xs text-muted-foreground p-2">Showing first 200 of {rows.length} rows.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
