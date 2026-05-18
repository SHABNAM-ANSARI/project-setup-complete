import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Edit3, Save, X, Search, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CLASS_OPTIONS } from "@/data/schoolData";

interface StudentRow {
  id: string;
  gr_no: string;
  name: string;
  class_name: string;
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

  const load = async () => {
    if (!className) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id,gr_no,name,class_name,roll_no,division,gender")
      .eq("class_name", className)
      .order("roll_no", { ascending: true });
    if (error) toast.error(error.message);
    setStudents((data as StudentRow[]) || []);
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
        s.name.toLowerCase().includes(q) ||
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
    const newName = String(draft.name || "").trim().toUpperCase();
    const newGr = String(draft.gr_no || "").trim();
    const newRoll = (draft.roll_no || "").toString().trim() || null;
    const newDivision = (draft.division || "").toString().trim() || null;

    if (!newName) return toast.error("Name cannot be empty");
    if (!newGr) return toast.error("GR No cannot be empty");

    // 1. Update student row
    const { error: sErr } = await supabase
      .from("students")
      .update({
        name: newName,
        gr_no: newGr,
        roll_no: newRoll,
        division: newDivision,
        updated_at: new Date().toISOString(),
      })
      .eq("id", original.id);
    if (sErr) return toast.error(`Student update failed: ${sErr.message}`);

    // 2. Cascade name / gr_no changes to marks so result cards stay correct
    const cascade: Record<string, string> = {};
    if (newName !== original.name) cascade.student_name = newName;
    if (newGr !== original.gr_no) cascade.gr_no = newGr;
    if (Object.keys(cascade).length) {
      const { error: mErr } = await supabase
        .from("marks")
        .update(cascade)
        .eq("gr_no", original.gr_no)
        .eq("class_name", original.class_name);
      if (mErr) toast.error(`Marks sync failed: ${mErr.message}`);
    }

    toast.success("Student updated");
    cancelEdit();
    load();
  };

  const deleteStudent = async (s: StudentRow) => {
    if (!isAdmin) return;
    if (!confirm(`Delete ${s.name} (GR ${s.gr_no})? This cannot be undone.`)) return;
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Student deleted");
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Click ✏️ to fix spelling, roll numbers, or GR numbers. Changes save instantly and update the marksheet automatically.
      </p>

      <div className="overflow-x-auto border-2 border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">GR No</th>
              <th className="text-left px-3 py-2">Roll</th>
              <th className="text-left px-3 py-2">Name</th>
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
                        value={String(draft.name ?? "")}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    ) : s.name}
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
