import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Edit3, Search, RefreshCw, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSubjectsForClass } from "@/data/subjectMapping";
import { calcResult, type MarkRow } from "@/lib/grades";
import { usePortalConfig, enabledExtraFields } from "@/lib/portalConfig";

interface StudentRow {
  id: string;
  gr_no: string;
  name: string;
  class_name: string;
  roll_no: string | null;
  division: string | null;
  gender: string | null;
  extra: Record<string, string> | null;
}

interface MarkRecord {
  id: string;
  gr_no: string;
  student_name: string;
  class_name: string;
  subject: string;
  term: string;
  marks: number | null;
  grade: string | null;
}

interface Props {
  className: string;
  term: string;
}

type TabKey = "students" | "marks";

export function RecordsTable({ className, term }: Props) {
  const { config } = usePortalConfig();
  const extraCols = enabledExtraFields(config);
  const [tab, setTab] = useState<TabKey>("students");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const load = async () => {
    setLoading(true);
    const [s, m] = await Promise.all([
      supabase
        .from("students")
        .select("id,gr_no,name,class_name,roll_no,division,gender,extra")
        .eq("class_name", className)
        .order("roll_no", { ascending: true }),
      supabase
        .from("marks")
        .select("id,gr_no,student_name,class_name,subject,term,marks,grade")
        .eq("class_name", className)
        .eq("term", term)
        .order("gr_no", { ascending: true }),
    ]);
    if (s.error) toast.error(s.error.message);
    if (m.error) toast.error(m.error.message);
    setStudents((s.data as StudentRow[]) || []);
    setMarks((m.data as MarkRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [className, term]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.gr_no.toLowerCase().includes(q) ||
        (s.roll_no || "").toLowerCase().includes(q),
    );
  }, [students, search]);

  const filteredMarks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return marks;
    return marks.filter(
      (m) =>
        m.student_name.toLowerCase().includes(q) ||
        m.gr_no.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q),
    );
  }, [marks, search]);

  const subjects = useMemo(() => getSubjectsForClass(className), [className]);

  const summaryByGr = useMemo(() => {
    const out: Record<string, ReturnType<typeof calcResult>> = {};
    for (const s of students) {
      const sm = marks.filter((m) => m.gr_no === s.gr_no);
      const byKey: Record<string, MarkRow> = {};
      for (const m of sm) byKey[m.subject] = m;
      out[s.gr_no] = calcResult(subjects, byKey);
    }
    return out;
  }, [students, marks, subjects]);

  const startEdit = (id: string, current: Record<string, any>) => {
    setEditId(id);
    const extra = (current.extra && typeof current.extra === "object") ? current.extra : {};
    setDraft({ ...current, ...Object.fromEntries(extraCols.map((c) => [`extra_${c.key}`, extra[c.key] || ""])) });
  };

  const cancelEdit = () => {
    setEditId(null);
    setDraft({});
  };

  const saveStudent = async () => {
    const id = editId!;
    const extra: Record<string, string> = {};
    for (const c of extraCols) {
      const v = String(draft[`extra_${c.key}`] || "").trim();
      if (v) extra[c.key] = v;
    }
    const { error } = await supabase
      .from("students")
      .update({
        name: String(draft.name || "").toUpperCase(),
        roll_no: (draft.roll_no as string) || null,
        division: (draft.division as string) || null,
        gender: (draft.gender as string) || null,
        extra,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student updated");
    cancelEdit();
    load();
  };

  const saveMark = async () => {
    const id = editId!;
    const m = Number(draft.marks);
    const { error } = await supabase
      .from("marks")
      .update({
        marks: Number.isFinite(m) ? m : null,
        grade: (draft.grade as string) || null,
        subject: String(draft.subject || ""),
        term: String(draft.term || ""),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mark updated");
    cancelEdit();
    load();
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student deleted");
    load();
  };

  const deleteMark = async (id: string) => {
    if (!confirm("Delete this mark entry?")) return;
    const { error } = await supabase.from("marks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mark deleted");
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("students")}
            className={`px-4 py-2 rounded-md font-bold text-sm ${tab === "students" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
          >
            Students ({students.length})
          </button>
          <button
            onClick={() => setTab("marks")}
            className={`px-4 py-2 rounded-md font-bold text-sm ${tab === "marks" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
          >
            Marks ({marks.length})
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="input-field pl-9"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={load}
            className="px-3 py-2 rounded-md border-2 border-muted-foreground/30 text-sm font-bold flex items-center gap-1 hover:bg-muted"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-card border-2 border-border rounded-lg">
        {tab === "students" ? (
          <table className="w-full text-sm">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="text-left px-3 py-2">GR No</th>
                <th className="text-left px-3 py-2">Roll</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Div</th>
                <th className="text-left px-3 py-2">Gender</th>
                {extraCols.map((c) => (
                  <th key={c.key} className="text-left px-3 py-2">{c.label}</th>
                ))}
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-right px-3 py-2">%</th>
                <th className="text-center px-3 py-2">Grade</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const sum = summaryByGr[s.gr_no];
                const isEdit = editId === s.id;
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{s.gr_no}</td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <input
                          className="input-field py-1"
                          value={(draft.roll_no as string) || ""}
                          onChange={(e) => setDraft({ ...draft, roll_no: e.target.value })}
                        />
                      ) : (s.roll_no || "")}
                    </td>
                    <td className="px-3 py-2 font-bold">
                      {isEdit ? (
                        <input
                          className="input-field py-1"
                          value={(draft.name as string) || ""}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                      ) : s.name}
                    </td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <input
                          className="input-field py-1 w-16"
                          value={(draft.division as string) || ""}
                          onChange={(e) => setDraft({ ...draft, division: e.target.value })}
                        />
                      ) : (s.division || "")}
                    </td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <select
                          className="input-field py-1"
                          value={(draft.gender as string) || ""}
                          onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                        >
                          <option value="">—</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      ) : (s.gender || "")}
                    </td>
                    {extraCols.map((c) => (
                      <td key={c.key} className="px-3 py-2">
                        {isEdit ? (
                          <input
                            className="input-field py-1"
                            value={String(draft[`extra_${c.key}`] || "")}
                            onChange={(e) => setDraft({ ...draft, [`extra_${c.key}`]: e.target.value })}
                          />
                        ) : (s.extra?.[c.key] || "")}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">{sum?.total ?? 0}/{sum?.outOf ?? 0}</td>
                    <td className="px-3 py-2 text-right">{sum?.percentage ?? 0}%</td>
                    <td className="px-3 py-2 text-center font-bold">{sum?.grade ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isEdit ? (
                        <>
                          <button onClick={saveStudent} className="text-accent font-bold text-xs mr-2 inline-flex items-center gap-1"><Save className="w-3 h-3" />Save</button>
                          <button onClick={cancelEdit} className="text-muted-foreground text-xs inline-flex items-center gap-1"><X className="w-3 h-3" />Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(s.id, s)} className="text-primary font-bold text-xs mr-3 inline-flex items-center gap-1"><Edit3 className="w-3 h-3" />Edit</button>
                          <button onClick={() => deleteStudent(s.id)} className="text-destructive font-bold text-xs inline-flex items-center gap-1"><Trash2 className="w-3 h-3" />Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredStudents.length && (
                <tr><td colSpan={9 + extraCols.length} className="text-center text-muted-foreground py-8">No students.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="text-left px-3 py-2">GR No</th>
                <th className="text-left px-3 py-2">Student</th>
                <th className="text-left px-3 py-2">Subject</th>
                <th className="text-left px-3 py-2">Term</th>
                <th className="text-right px-3 py-2">Marks</th>
                <th className="text-center px-3 py-2">Grade</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMarks.map((m) => {
                const isEdit = editId === m.id;
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{m.gr_no}</td>
                    <td className="px-3 py-2">{m.student_name}</td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <input
                          className="input-field py-1"
                          value={(draft.subject as string) || ""}
                          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                        />
                      ) : m.subject}
                    </td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <input
                          className="input-field py-1"
                          value={(draft.term as string) || ""}
                          onChange={(e) => setDraft({ ...draft, term: e.target.value })}
                        />
                      ) : m.term}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEdit ? (
                        <input
                          type="number"
                          className="input-field py-1 w-20 text-right"
                          value={draft.marks === null || draft.marks === undefined ? "" : String(draft.marks)}
                          onChange={(e) => setDraft({ ...draft, marks: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      ) : (m.marks ?? "—")}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isEdit ? (
                        <input
                          className="input-field py-1 w-16 text-center"
                          value={(draft.grade as string) || ""}
                          onChange={(e) => setDraft({ ...draft, grade: e.target.value.toUpperCase() })}
                        />
                      ) : (m.grade || "—")}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isEdit ? (
                        <>
                          <button onClick={saveMark} className="text-accent font-bold text-xs mr-2 inline-flex items-center gap-1"><Save className="w-3 h-3" />Save</button>
                          <button onClick={cancelEdit} className="text-muted-foreground text-xs inline-flex items-center gap-1"><X className="w-3 h-3" />Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(m.id, m)} className="text-primary font-bold text-xs mr-3 inline-flex items-center gap-1"><Edit3 className="w-3 h-3" />Edit</button>
                          <button onClick={() => deleteMark(m.id)} className="text-destructive font-bold text-xs inline-flex items-center gap-1"><Trash2 className="w-3 h-3" />Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredMarks.length && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No marks for this term.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
