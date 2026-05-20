import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  CLASS_OPTIONS,
  getTeacherForClass,
} from "@/data/schoolData";
import {
  getSubjectsForClass,
  GRADE_OPTIONS,
  PASSING_MARKS,
  MAX_MARKS,
  TERM_OPTIONS,
  type GradeValue,
  type SubjectDef,
} from "@/data/subjectMapping";

interface AdminDashboardProps {
  userMobile?: string;
}

interface DBStudent {
  id: string;
  gr_no: string;
  class: string;
  name: string;
  roll_no: string | null;
  division: string | null;
  gender: string | null;
  dob: string | null;
  contact: string | null;
  exam_year: string | null;
}

const emptyStudent = (cls: string): Partial<DBStudent> => ({
  gr_no: "",
  class: cls,
  name: "",
  roll_no: "",
  division: "A",
  gender: "M",
  dob: "",
  contact: "",
  exam_year: "2026-27",
});

type Tab = "students" | "marks";

// 🔒 Master password gate. Change this string to update the password.
const MASTER_PASSWORD = "dunnes@2027";
const UNLOCK_KEY = "dunnes_admin_unlocked";

const AdminDashboard = ({ userMobile }: AdminDashboardProps) => {
  const [unlocked, setUnlocked] = useState<boolean>(
    () => sessionStorage.getItem(UNLOCK_KEY) === "1"
  );
  const [pwInput, setPwInput] = useState("");

  const [tab, setTab] = useState<Tab>("students");
  const [classFilter, setClassFilter] = useState<string>(CLASS_OPTIONS[0] || "");
  const [students, setStudents] = useState<DBStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<DBStudent> | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const loadStudents = async (cls: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("class", cls)
      .order("name");
    setLoading(false);
    if (error) {
      toast.error("Failed to load students");
      return;
    }
    setStudents((data as DBStudent[]) || []);
  };

  useEffect(() => {
    if (unlocked && classFilter) loadStudents(classFilter);
  }, [classFilter, unlocked]);

  const saveStudent = async () => {
    if (!editing) return;
    if (!editing.gr_no || !editing.name || !editing.class) {
      toast.error("GR No, Name, and Class are required");
      return;
    }
    setSaving(true);
    const payload: any = {
      gr_no: editing.gr_no,
      class: editing.class,
      name: editing.name,
      roll_no: editing.roll_no || null,
      division: editing.division || null,
      gender: editing.gender || null,
      dob: editing.dob || null,
      contact: editing.contact || null,
      exam_year: editing.exam_year || null,
    };
    const { error } = await supabase
      .from("students")
      .upsert(payload, { onConflict: "gr_no,class" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Student saved");
    setEditing(null);
    loadStudents(classFilter);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadStudents(classFilter);
  };

  const inlineUpdate = async (id: string, patch: Partial<DBStudent>) => {
    const { error } = await supabase.from("students").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    toast.success("Updated");
  };

  // ---------- Password gate ----------
  if (!unlocked) {
    const tryUnlock = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (pwInput === MASTER_PASSWORD) {
        sessionStorage.setItem(UNLOCK_KEY, "1");
        setUnlocked(true);
        toast.success("Admin unlocked");
      } else {
        toast.error("Incorrect password");
        setPwInput("");
      }
    };
    return (
      <div className="bg-card p-8 rounded-xl shadow-md border border-primary/10 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-primary mb-2">🔒 Admin Access</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Enter master password to manage students and marks.
        </p>
        <form onSubmit={tryUnlock} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            placeholder="Master password"
            className="input-field w-full"
          />
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-bold text-sm hover:bg-primary/90"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  // ---------- Filter (search) ----------
  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.gr_no.toLowerCase().includes(q) ||
      (s.roll_no || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-card p-6 rounded-xl shadow-md border border-primary/10 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-primary">🛠 Admin Dashboard</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border-2 border-primary">
            <button
              onClick={() => setTab("students")}
              className={`px-4 py-1.5 text-sm font-bold ${tab === "students" ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}
            >
              Students
            </button>
            <button
              onClick={() => setTab("marks")}
              className={`px-4 py-1.5 text-sm font-bold ${tab === "marks" ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}
            >
              Marksheet Entry
            </button>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem(UNLOCK_KEY);
              setUnlocked(false);
            }}
            className="text-xs text-muted-foreground hover:text-destructive underline"
            title="Lock admin"
          >
            Lock
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold text-foreground">Class:</label>
        <select
          className="input-field max-w-xs"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          {CLASS_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Class Teacher: <strong>{getTeacherForClass(classFilter) || "—"}</strong>
        </span>
        <input
          type="text"
          placeholder="🔍 Search by name or GR No…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field flex-1 min-w-[200px] max-w-sm ml-auto"
        />
      </div>

      {tab === "students" ? (
        <StudentsTab
          students={filteredStudents}
          totalCount={students.length}
          loading={loading}
          classFilter={classFilter}
          onAdd={() => setEditing(emptyStudent(classFilter))}
          onEdit={setEditing}
          onDelete={deleteStudent}
          onInlineUpdate={inlineUpdate}
          onBulkImported={() => loadStudents(classFilter)}
        />
      ) : (
        <MarksheetTab classFilter={classFilter} students={filteredStudents} userMobile={userMobile} />
      )}

      {editing && (
        <StudentEditModal
          editing={editing}
          setEditing={setEditing}
          onSave={saveStudent}
          saving={saving}
        />
      )}
    </div>
  );
};

/* ----- STUDENTS TAB ----- */
const StudentsTab = ({
  students, totalCount, loading, classFilter, onAdd, onEdit, onDelete, onInlineUpdate, onBulkImported,
}: {
  students: DBStudent[];
  totalCount: number;
  loading: boolean;
  classFilter: string;
  onAdd: () => void;
  onEdit: (s: DBStudent) => void;
  onDelete: (id: string) => void;
  onInlineUpdate: (id: string, patch: Partial<DBStudent>) => void;
  onBulkImported: () => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleCSV = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error("CSV is empty");
        return;
      }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (k: string) => header.indexOf(k);
      const cGr = idx("gr_no") !== -1 ? idx("gr_no") : idx("gr no");
      const cName = idx("name");
      const cClass = idx("class") !== -1 ? idx("class") : idx("class");
      const cRoll = idx("roll_no") !== -1 ? idx("roll_no") : idx("roll");
      const cDiv = idx("division") !== -1 ? idx("division") : idx("div");
      const cGender = idx("gender");
      const cDob = idx("dob");
      const cParent = idx("parent_name") !== -1 ? idx("parent_name") : idx("parent");
      const cContact = idx("contact");
      const cAddress = idx("address");
      const cYear = idx("exam_year") !== -1 ? idx("exam_year") : idx("year");

      if (cGr === -1 || cName === -1) {
        toast.error("CSV must include 'gr_no' and 'name' columns");
        return;
      }

      const payload = rows.slice(1)
        .filter((r) => (r[cGr] || "").trim() && (r[cName] || "").trim())
        .map((r) => ({
          gr_no: (r[cGr] || "").trim(),
          name: (r[cName] || "").trim(),
          class: (cClass !== -1 ? (r[cClass] || "").trim() : "") || classFilter,
          roll_no: cRoll !== -1 ? ((r[cRoll] || "").trim() || null) : null,
          division: cDiv !== -1 ? ((r[cDiv] || "").trim() || null) : null,
          gender: cGender !== -1 ? ((r[cGender] || "").trim() || null) : null,
          dob: cDob !== -1 ? ((r[cDob] || "").trim() || null) : null,
          parent_name: cParent !== -1 ? ((r[cParent] || "").trim() || null) : null,
          contact: cContact !== -1 ? ((r[cContact] || "").trim() || null) : null,
          address: cAddress !== -1 ? ((r[cAddress] || "").trim() || null) : null,
          exam_year: cYear !== -1 ? ((r[cYear] || "").trim() || "2026-27") : "2026-27",
        }));

      if (payload.length === 0) {
        toast.error("No valid rows found");
        return;
      }

      const { error } = await supabase
        .from("students")
        .upsert(payload, { onConflict: "gr_no,class" });
      if (error) {
        toast.error(`Import failed: ${error.message}`);
        return;
      }
      toast.success(`Imported ${payload.length} students`);
      onBulkImported();
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {students.length} of {totalCount} students in {classFilter}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCSV(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="border-2 border-primary text-primary px-3 py-2 rounded-md font-bold text-sm hover:bg-primary/10 disabled:opacity-50"
            title="CSV columns: gr_no, name, class, roll_no (optional), division, gender, dob, parent_name, contact, address"
          >
            {importing ? "Importing…" : "📥 Bulk Import CSV"}
          </button>
          <button
            onClick={onAdd}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-bold text-sm hover:bg-primary/90"
          >
            + Add Student
          </button>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        💡 Click any <strong>Roll No</strong> or <strong>Name</strong> cell to edit it inline. Roll No can be left blank.
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground">Loading…</div>
      ) : students.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">No students. Use "Add Student" or "Bulk Import CSV".</div>
      ) : (
        <div className="overflow-x-auto border-2 border-primary/30 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="px-2 py-2 text-left">GR No</th>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2">Roll</th>
                <th className="px-2 py-2">Div</th>
                <th className="px-2 py-2">Gender</th>
                <th className="px-2 py-2 text-left">Parent</th>
                <th className="px-2 py-2 text-left">Contact</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-primary/20 hover:bg-primary/5">
                  <td className="px-2 py-1.5 font-mono">{s.gr_no}</td>
                  <td className="px-2 py-1.5 font-semibold uppercase">
                    <InlineEdit
                      value={s.name}
                      onSave={(v) => v && v !== s.name && onInlineUpdate(s.id, { name: v })}
                      className="uppercase font-semibold"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <InlineEdit
                      value={s.roll_no || ""}
                      placeholder="—"
                      onSave={(v) => v !== (s.roll_no || "") && onInlineUpdate(s.id, { roll_no: v || null })}
                      className="text-center w-16"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">{s.division || "—"}</td>
                  <td className="px-2 py-1.5 text-center">{s.gender || "—"}</td>
                  <td className="px-2 py-1.5">{s.contact || "—"}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(s)} className="text-primary font-bold text-xs mr-3 hover:underline">Edit</button>
                    <button onClick={() => onDelete(s.id)} className="text-destructive font-bold text-xs hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ----- INLINE EDIT CELL ----- */
const InlineEdit = ({
  value, onSave, placeholder, className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`text-left w-full hover:bg-primary/10 px-1 rounded ${className || ""}`}
      >
        {value || <span className="text-muted-foreground">{placeholder || "—"}</span>}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { setEditing(false); onSave(val.trim()); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { setEditing(false); onSave(val.trim()); }
        if (e.key === "Escape") { setEditing(false); setVal(value); }
      }}
      className={`input-field py-0.5 px-1 text-sm ${className || ""}`}
    />
  );
};

/* ----- CSV PARSER (handles quoted fields) ----- */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"' && t[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ----- STUDENT EDIT MODAL ----- */
const StudentEditModal = ({
  editing, setEditing, onSave, saving,
}: {
  editing: Partial<DBStudent>;
  setEditing: (s: Partial<DBStudent> | null) => void;
  onSave: () => void;
  saving: boolean;
}) => {
  const set = (k: keyof DBStudent, v: any) => setEditing({ ...editing, [k]: v });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-primary mb-4">
          {editing.id ? "Edit Student" : "Add New Student"}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="GR No *">
            <input className="input-field" value={editing.gr_no || ""} onChange={(e) => set("gr_no", e.target.value)} />
          </Field>
          <Field label="Class *">
            <select className="input-field" value={editing.class || ""} onChange={(e) => set("class", e.target.value)}>
              {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Full Name *" full>
            <input className="input-field uppercase" value={editing.name || ""} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Roll No (optional)">
            <input className="input-field" value={editing.roll_no || ""} onChange={(e) => set("roll_no", e.target.value)} />
          </Field>
          <Field label="Division">
            <input className="input-field" value={editing.division || ""} onChange={(e) => set("division", e.target.value)} />
          </Field>
          <Field label="Gender">
            <select className="input-field" value={editing.gender || ""} onChange={(e) => set("gender", e.target.value)}>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Date of Birth">
            <input type="date" className="input-field" value={editing.dob || ""} onChange={(e) => set("dob", e.target.value)} />
          </Field>
          <Field label="Contact No">
            <input className="input-field" value={editing.contact || ""} onChange={(e) => set("contact", e.target.value)} />
          </Field>
          <Field label="Exam Year">
            <input className="input-field" value={editing.exam_year || ""} onChange={(e) => set("exam_year", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border-2 border-muted-foreground/30 font-bold text-sm">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) => (
  <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
    <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
    {children}
  </label>
);

/* ----- MARKSHEET TAB ----- */
const MarksheetTab = ({
  classFilter, students, userMobile,
}: {
  classFilter: string;
  students: DBStudent[];
  userMobile?: string;
}) => {
  const [grNo, setGrNo] = useState("");
  const [term, setTerm] = useState<string>(TERM_OPTIONS[0]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, GradeValue | "">>({});
  const [remarks, setRemarks] = useState("");
  const [teacherSig, setTeacherSig] = useState("");
  const [principalSig, setPrincipalSig] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const subjects: SubjectDef[] = useMemo(() => getSubjectsForClass(classFilter), [classFilter]);
  const regularSubjects = subjects.filter((s) => s.type === "regular");
  const creditSubjects = subjects.filter((s) => s.type === "credit");
  const student = students.find((s) => s.gr_no === grNo);

  // Reset on class change
  useEffect(() => { setGrNo(""); }, [classFilter]);

  // Load saved marks/remarks for this student+term
  useEffect(() => {
    if (!grNo || !term) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMarks({}); setGrades({}); setRemarks(""); setTeacherSig(""); setPrincipalSig("");
      const [m, r] = await Promise.all([
        supabase.from("marks").select("subject, marks, grade")
          .eq("class", classFilter).eq("term", term).eq("gr_no", grNo),
        supabase.from("student_term_remarks").select("remarks, teacher_signature, principal_signature")
          .eq("class", classFilter).eq("term", term).eq("gr_no", grNo).maybeSingle(),
      ]);
      if (cancelled) return;
      if (m.data) {
        const mm: Record<string, string> = {};
        const gg: Record<string, GradeValue | ""> = {};
        m.data.forEach((row: any) => {
          if (row.marks != null) mm[row.subject] = String(row.marks);
          if (row.grade) gg[row.subject] = row.grade;
        });
        setMarks(mm); setGrades(gg);
      }
      if (r.data) {
        setRemarks(r.data.remarks || "");
        setTeacherSig(r.data.teacher_signature || "");
        setPrincipalSig(r.data.principal_signature || "");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [grNo, term, classFilter]);

  const save = async () => {
    if (!student) return toast.error("Select a student");
    setSaving(true);
    const marksData = [
      ...regularSubjects.map((sub) => ({
        class: classFilter, term, gr_no: student.gr_no, student_name: student.name,
        subject: sub.name,
        marks: Math.max(0, Math.min(MAX_MARKS, Number(marks[sub.name]) || 0)),
        grade: null as string | null,
        entered_by_mobile: userMobile || null,
      })),
      ...creditSubjects.filter((sub) => grades[sub.name]).map((sub) => ({
        class: classFilter, term, gr_no: student.gr_no, student_name: student.name,
        subject: sub.name,
        marks: null as number | null,
        grade: grades[sub.name] || null,
        entered_by_mobile: userMobile || null,
      })),
    ];
    const { error: e1 } = await supabase
      .from("marks")
      .upsert(marksData, { onConflict: "class,term,gr_no,subject" });
    if (e1) { setSaving(false); return toast.error(`Marks save failed: ${e1.message}`); }

    const { error: e2 } = await supabase
      .from("student_term_remarks")
      .upsert({
        class: classFilter, term, gr_no: student.gr_no, student_name: student.name,
        remarks, teacher_signature: teacherSig, principal_signature: principalSig,
        entered_by_mobile: userMobile || null,
      }, { onConflict: "class,term,gr_no" });
    setSaving(false);
    if (e2) return toast.error(`Remarks save failed: ${e2.message}`);
    toast.success(`Saved marks for ${student.name}`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-muted-foreground">
            Student ({students.length} in {classFilter})
          </span>
          <select className="input-field" value={grNo} onChange={(e) => setGrNo(e.target.value)}>
            <option value="">— Select student —</option>
            {students.map((s) => (
              <option key={s.id} value={s.gr_no}>
                {s.roll_no ? `#${s.roll_no} • ` : ""}{s.gr_no} • {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-muted-foreground">Term</span>
          <select className="input-field" value={term} onChange={(e) => setTerm(e.target.value)}>
            {TERM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {!student ? (
        <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-primary/30 rounded-lg">
          Select a student to enter marks.
        </div>
      ) : loading ? (
        <div className="text-center py-6 text-muted-foreground">Loading saved marks…</div>
      ) : (
        <>
          <div className="border-2 border-primary/30 rounded-lg p-4">
            <h3 className="font-bold text-primary uppercase text-sm mb-3">
              📘 Regular Subjects (out of {MAX_MARKS}, pass = {PASSING_MARKS})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {regularSubjects.map((sub) => {
                const v = Number(marks[sub.name]) || 0;
                const fail = v > 0 && v < PASSING_MARKS;
                return (
                  <label key={sub.name} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase">{sub.name}</span>
                    <input
                      type="number" min={0} max={MAX_MARKS}
                      value={marks[sub.name] ?? ""}
                      onChange={(e) => setMarks({ ...marks, [sub.name]: e.target.value })}
                      placeholder="0"
                      className={`input-field text-center ${fail ? "border-destructive text-destructive" : ""}`}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-2 border-accent rounded-lg p-4 bg-accent/5">
            <h3 className="font-bold text-primary uppercase text-sm mb-3">🎨 Credit Subjects (Grade)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {creditSubjects.map((sub) => (
                <label key={sub.name} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase">{sub.name}</span>
                  <select
                    value={grades[sub.name] || ""}
                    onChange={(e) => setGrades({ ...grades, [sub.name]: e.target.value as GradeValue | "" })}
                    className="input-field"
                  >
                    <option value="">— Select —</option>
                    {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="border-2 border-primary/30 rounded-lg p-4 space-y-3">
            <h3 className="font-bold text-primary uppercase text-sm">📝 Remarks & Signatures</h3>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Teacher's remarks…"
              rows={3}
              className="input-field w-full"
            />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Teacher's signature" className="input-field"
                value={teacherSig} onChange={(e) => setTeacherSig(e.target.value)} />
              <input type="text" placeholder="Principal's signature" className="input-field"
                value={principalSig} onChange={(e) => setPrincipalSig(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "💾 Save to Cloud"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
