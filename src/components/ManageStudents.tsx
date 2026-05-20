import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Edit3, Save, X, Search, RefreshCw, Trash2, Upload, FileDown } from "lucide-react";
import { parseStudentsFile, downloadStudentsTemplate, type ParsedStudentRow } from "@/lib/marksParser";
import { supabase } from "@/lib/supabase";
import { CLASS_OPTIONS } from "@/data/schoolData";

interface StudentRow {
  id: string;
  gr_no: string;
  student_name: string;
  class: string;
  roll_no: string | null;
  division: string | null;
  gender: string | null;
}

interface Props {
  isAdmin: boolean;
  defaultClass?: string;
}

export default function ManageStudents({ isAdmin, defaultClass }: Props) {
  const [className, setClassName] = useState<string>(defaultClass || CLASS_OPTIONS[0] || "");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<StudentRow>>({});
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedStudentRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!className) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id,gr_no,student_name,class,roll_no,division,gender")
      .eq("class", className)
      .order("roll_no", { ascending: true });
    if (error) toast.error(error.message);
    setStudents((data as unknown as StudentRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [className]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        s.gr_no.toLowerCase().includes(q) ||
        (s.roll_no || "").toLowerCase().includes(q),
    );
  }, [students, search]);

  const startEdit = (s: StudentRow) => {
    setEditId(s.id);
    setDraft({ ...s });
  };

  const cancelEdit = () => {
    setEditId(null);
    setDraft({});
  };

  const saveEdit = async (original: StudentRow) => {
    const newName = String(draft.student_name || "").trim().toUpperCase();
    const newGr = String(draft.gr_no || "").trim();
    const newRoll = (draft.roll_no || "").toString().trim() || null;
    const newDivision = (draft.division || "").toString().trim() || null;

    if (!newName) return toast.error("Name cannot be empty");
    if (!newGr) return toast.error("GR No cannot be empty");

    const { error: sErr } = await supabase
      .from("students")
      .update({
        student_name: newName,
        gr_no: newGr,
        roll_no: newRoll,
        division: newDivision,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", original.id);
    if (sErr) return toast.error(`Student update failed: ${sErr.message}`);

    const cascade: Record<string, string> = {};
    if (newName !== original.student_name) cascade.student_name = newName;
    if (newGr !== original.gr_no) cascade.gr_no = newGr;
    if (Object.keys(cascade).length) {
      const { error: mErr } = await supabase
        .from("marks")
        .update(cascade as never)
        .eq("gr_no", original.gr_no)
        .eq("class", original.class);
      if (mErr) toast.error(`Marks sync failed: ${mErr.message}`);
    }

    toast.success("Student updated");
    cancelEdit();
    load();
  };

  const deleteStudent = async (s: StudentRow) => {
    if (!isAdmin) return;
    if (!confirm(`Delete ${s.student_name} (GR ${s.gr_no})? This cannot be undone.`)) return;
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Student deleted");
    load();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseStudentsFile(file, className);
      if (!rows.length) return toast.error("File is empty");
      setPreview(rows);
    } catch (err) {
      toast.error(`Parse failed: ${(err as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    const valid = preview.filter((r) => !r._error);
    if (!valid.length) return toast.error("No valid rows to import");
    setImporting(true);
    const payload = valid.map((r) => ({
      gr_no: r.gr_no,
      student_name: r.student_name,
      class: r.class,
      roll_no: r.roll_no,
      division: r.division,
      gender: r.gender,
      exam_year: r.exam_year ?? "2026-27",
    }));

    const { error } = await supabase
      .from("students")
      .upsert(payload as never, { onConflict: "gr_no,class" });
    setImporting(false);
    if (error) return toast.error(`Import failed: ${error.message}`);
    toast.success(`Imported ${payload.length} students`);
    setPreview(null);
    load();
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-md border border-primary/10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-primary">👥 Manage Students & Edit Marks</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="input-field py-2"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          >
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="input-field pl-9 py-2"
              placeholder="Search name / GR / roll…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-md border-2 border-muted-foreground/30 text-sm font-bold flex items-center gap-1 hover:bg-muted"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => downloadStudentsTemplate()}
            className="px-3 py-2 rounded-md border-2 border-primary/30 text-sm font-bold flex items-center gap-1 hover:bg-primary/5 text-primary"
          >
            <FileDown className="w-4 h-4" /> Template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1 hover:opacity-90"
          >
            <Upload className="w-4 h-4" /> Import CSV/Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>

      {preview && (
        <div className="mb-4 border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-primary">
              Preview: {preview.length} rows
              {preview.some((r) => r._error) && (
                <span className="ml-2 text-destructive text-sm">
                  ({preview.filter((r) => r._error).length} with errors will be skipped)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="px-3 py-1.5 text-sm rounded border-2 border-muted-foreground/30 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importing}
                className="px-3 py-1.5 text-sm rounded bg-accent text-accent-foreground font-bold"
              >
                {importing ? "Importing…" : "Confirm Import"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-64 border border-border rounded bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1">Row</th>
                  <th className="text-left px-2 py-1">GR</th>
                  <th className="text-left px-2 py-1">Student Name</th>
                  <th className="text-left px-2 py-1">Class</th>
                  <th className="text-left px-2 py-1">Roll</th>
                  <th className="text-left px-2 py-1">Div</th>
                  <th className="text-left px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r._row} className={`border-t border-border ${r._error ? "bg-destructive/10" : ""}`}>
                    <td className="px-2 py-1">{r._row}</td>
                    <td className="px-2 py-1 font-mono">{r.gr_no}</td>
                    <td className="px-2 py-1">{r.student_name}</td>
                    <td className="px-2 py-1">{r.class}</td>
                    <td className="px-2 py-1">{r.roll_no}</td>
                    <td className="px-2 py-1">{r.division}</td>
                    <td className="px-2 py-1">{r._error ? `❌ ${r._error}` : "✅ OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">
        Click ✏️ to fix spelling, roll numbers, or GR numbers. Changes save instantly and update the marksheet automatically.
      </p>

      <div className="overflow-x-auto border-2 border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">GR No</th>
              <th className="text-left px-3 py-2">Roll</th>
              <th className="text-left px-3 py-2">Student Name</th>
              <th className="text-left px-3 py-2">Div</th>
              <th className="text-left px-3 py-2">Gender</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isEdit = editId === s.id;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">
                    {isEdit ? (
                      <input
                        className="input-field py-1 w-28"
                        value={String(draft.gr_no ?? "")}
                        onChange={(e) => setDraft({ ...draft, gr_no: e.target.value })}
                      />
                    ) : s.gr_no}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit ? (
                      <input
                        className="input-field py-1 w-20"
                        value={String(draft.roll_no ?? "")}
                        onChange={(e) => setDraft({ ...draft, roll_no: e.target.value })}
                      />
                    ) : (s.roll_no || "")}
                  </td>
                  <td className="px-3 py-2 font-bold">
                    {isEdit ? (
                      <input
                        className="input-field py-1 w-full min-w-[200px]"
                        value={String(draft.student_name ?? "")}
                        onChange={(e) => setDraft({ ...draft, student_name: e.target.value })}
                      />
                    ) : s.student_name}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit ? (
                      <input
                        className="input-field py-1 w-16"
                        value={String(draft.division ?? "")}
                        onChange={(e) => setDraft({ ...draft, division: e.target.value })}
                      />
                    ) : (s.division || "")}
                  </td>
                  <td className="px-3 py-2">{s.gender || ""}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEdit ? (
                      <>
                        <button
                          onClick={() => saveEdit(s)}
                          className="text-accent font-bold text-xs mr-2 inline-flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-muted-foreground text-xs inline-flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(s)}
                          title="Edit student"
                          className="text-primary font-bold text-xs mr-3 inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> ✏️ Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => deleteStudent(s)}
                            className="text-destructive font-bold text-xs inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading…" : "No students found for this class."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Tip: To edit subject marks, open <strong>Enter Marks</strong> for the same class & term —
        any changes here (name / GR) flow through to the marks table automatically.
      </p>
    </div>
  );
}
