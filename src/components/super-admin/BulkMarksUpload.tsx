import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileDown, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseMarksFile, downloadTemplate, type ParsedMarkRow } from "@/lib/marksParser";

interface Props {
  defaultClass: string;
  onImported?: () => void;
}

export function BulkMarksUpload({ defaultClass, onImported }: Props) {
  const [rows, setRows] = useState<ParsedMarkRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File) => {
    setFile(f);
    try {
      const parsed = await parseMarksFile(f, defaultClass);
      setRows(parsed);
      toast.success(`Parsed ${parsed.length} rows from ${f.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const validRows = rows.filter((r) => !r._error);
  const errorRows = rows.filter((r) => r._error);

  const importNow = async () => {
    if (!validRows.length) {
      toast.error("Nothing to import");
      return;
    }
    setBusy(true);
    const payload = validRows.map((r) => ({
      gr_no: r.gr_no,
      student_name: r.student_name,
      class_name: r.class_name,
      term: r.term,
      subject: r.subject,
      marks: r.marks,
      grade: r.grade,
      updated_at: new Date().toISOString(),
    }));
    // Upsert in batches of 200 to stay under request limits.
    let inserted = 0;
    for (let i = 0; i < payload.length; i += 200) {
      const batch = payload.slice(i, i + 200);
      const { error } = await supabase.from("marks").upsert(batch);
      if (error) {
        setBusy(false);
        toast.error(`Failed at batch ${i}: ${error.message}`);
        return;
      }
      inserted += batch.length;
    }
    setBusy(false);
    toast.success(`Imported ${inserted} marks`);
    setRows([]);
    setFile(null);
    onImported?.();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border-2 border-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Bulk Marks Upload</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a CSV or Excel file. Required columns: <code className="font-mono">gr_no, student_name, subject, term, marks</code> (or <code className="font-mono">grade</code> for credit subjects).
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="text-sm font-bold text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" /> Template
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
                {rows.slice(0, 200).map((r) => (
                  <tr key={r._row} className={`border-t border-border ${r._error ? "bg-destructive/5" : ""}`}>
                    <td className="px-2 py-1 font-mono">{r._row}</td>
                    <td className="px-2 py-1">{r.gr_no}</td>
                    <td className="px-2 py-1">{r.student_name}</td>
                    <td className="px-2 py-1">{r.class_name}</td>
                    <td className="px-2 py-1">{r.term}</td>
                    <td className="px-2 py-1">{r.subject}</td>
                    <td className="px-2 py-1 text-right">{r.marks ?? ""}</td>
                    <td className="px-2 py-1 text-center">{r.grade ?? ""}</td>
                    <td className="px-2 py-1">{r._error ? <span className="text-destructive">{r._error}</span> : <span className="text-accent">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && (
              <p className="text-xs text-muted-foreground p-2">Showing first 200 of {rows.length} rows.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
