import { useState, useEffect, useMemo } from "react";
import DunnesHeader from "./DunnesHeader";
import signature from "@/assets/principal-signature.png";
import { getTeacherForClass } from "@/data/schoolData";
import { useStudentsByClass } from "@/hooks/useStudentsByClass";
import {
  getSubjectsForClass,
  GRADE_OPTIONS,
  PASSING_MARKS,
  MAX_MARKS,
  computeTotal,
  computePercentage,
  type GradeValue,
  type SubjectDef,
} from "@/data/subjectMapping";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ResultCard from "./ResultCard";

interface Student {
  grNo: string;
  name: string;
  rollNo: string;
  marks: Record<string, number>; // numeric for regular subjects
  grades: Record<string, GradeValue | "">; // grade for credit subjects
}

interface RemarksRow {
  remarks: string;
  teacherSignature: string;
  principalSignature: string;
}

interface MarksheetEntryProps {
  selectedClass: string;
  selectedTerm: string;
  userMobile?: string;
}

const getGrade = (percentage: number): string => {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "E";
};

const MarksheetEntry = ({ selectedClass, selectedTerm, userMobile }: MarksheetEntryProps) => {
  const [currentTerm, setCurrentTerm] = useState(selectedTerm);
  useEffect(() => { setCurrentTerm(selectedTerm); }, [selectedTerm]);
  const subjects: SubjectDef[] = useMemo(() => getSubjectsForClass(selectedClass), [selectedClass]);
  const regularSubjects = useMemo(() => subjects.filter((s) => s.type === "regular"), [subjects]);
  const creditSubjects = useMemo(() => subjects.filter((s) => s.type === "credit"), [subjects]);
  const classTeacher = getTeacherForClass(selectedClass);

  const { students: classRoster } = useStudentsByClass(selectedClass);

  const baseStudents = useMemo<Student[]>(() => {
    return classRoster.map((s, idx) => ({
      grNo: s.grNo,
      name: s.name,
      rollNo: s.rollNo || String(idx + 1),
      marks: Object.fromEntries(regularSubjects.map((sub) => [sub.name, 0])),
      grades: Object.fromEntries(creditSubjects.map((sub) => [sub.name, ""])) as Record<string, GradeValue | "">,
    }));
  }, [classRoster, regularSubjects, creditSubjects]);

  const [students, setStudents] = useState<Student[]>(baseStudents);
  const [remarksByGr, setRemarksByGr] = useState<Record<string, RemarksRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string>("");
  const [previewGrNo, setPreviewGrNo] = useState<string>("");
  const [viewMode, setViewMode] = useState<"single" | "all">("single");
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Load saved marks + remarks
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setStudents(baseStudents);
      setRemarksByGr({});

      const [marksRes, remarksRes] = await Promise.all([
        supabase
          .from("marks")
          .select("gr_no, subject, marks, grade")
          .eq("class", selectedClass)
          .eq("term", currentTerm),
        supabase
          .from("student_term_remarks")
          .select("gr_no, remarks, teacher_signature, principal_signature")
          .eq("class", selectedClass)
          .eq("term", currentTerm),
      ]);

      if (cancelled) return;

      if (marksRes.error) {
        toast.error("Could not load saved marks.");
        console.error(marksRes.error);
      } else if (marksRes.data) {
        const marksMap: Record<string, Record<string, number>> = {};
        const gradeMap: Record<string, Record<string, GradeValue>> = {};
        marksRes.data.forEach((row: any) => {
          if (row.marks !== null && row.marks !== undefined) {
            marksMap[row.gr_no] ||= {};
            marksMap[row.gr_no][row.subject] = row.marks;
          }
          if (row.grade) {
            gradeMap[row.gr_no] ||= {};
            gradeMap[row.gr_no][row.subject] = row.grade;
          }
        });
        setStudents((prev) =>
          prev.map((s) => ({
            ...s,
            marks: { ...s.marks, ...(marksMap[s.grNo] || {}) },
            grades: { ...s.grades, ...(gradeMap[s.grNo] || {}) },
          })),
        );
      }

      if (!remarksRes.error && remarksRes.data) {
        const map: Record<string, RemarksRow> = {};
        remarksRes.data.forEach((row: any) => {
          map[row.gr_no] = {
            remarks: row.remarks || "",
            teacherSignature: row.teacher_signature || "",
            principalSignature: row.principal_signature || "",
          };
        });
        setRemarksByGr(map);
      }

      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedClass, currentTerm, baseStudents]);

  const updateMark = (grNo: string, subject: SubjectDef, value: number) => {
    const clamped = Math.min(MAX_MARKS, Math.max(0, value));
    setStudents((prev) =>
      prev.map((s) =>
        s.grNo === grNo ? { ...s, marks: { ...s.marks, [subject.name]: clamped } } : s,
      ),
    );
  };

  const updateGrade = (grNo: string, subject: SubjectDef, value: GradeValue | "") => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grNo === grNo ? { ...s, grades: { ...s.grades, [subject.name]: value } } : s,
      ),
    );
  };

  const saveStudent = async (student: Student) => {
    setSavingKey(student.grNo);
    const marksData = [
      ...regularSubjects.map((sub) => ({
        class: selectedClass,
        term: currentTerm,
        gr_no: student.grNo,
        student_name: student.name,
        subject: sub.name,
        marks: student.marks[sub.name] ?? 0,
        grade: null as string | null,
        entered_by_mobile: userMobile || null,
      })),
      ...creditSubjects
        .filter((sub) => student.grades[sub.name])
        .map((sub) => ({
          class: selectedClass,
          term: currentTerm,
          gr_no: student.grNo,
          student_name: student.name,
          subject: sub.name,
          marks: null as number | null,
          grade: student.grades[sub.name] || null,
          entered_by_mobile: userMobile || null,
        })),
    ];
    const { error } = await supabase
      .from("marks")
      .upsert(marksData, { onConflict: "class,term,gr_no,subject" });
    setSavingKey("");
    if (error) {
      console.error(error);
      toast.error(`Save failed for ${student.name}`);
      return false;
    }
    // Also save remarks if present
    const r = remarksByGr[student.grNo];
    if (r && (r.remarks || r.teacherSignature || r.principalSignature)) {
      await persistRemarks(student, r);
    }
    setSavedAt(new Date().toLocaleTimeString());
    return true;
  };

  const saveAll = async () => {
    setBulkSaving(true);
    let ok = 0;
    let fail = 0;
    for (const s of students) {
      // skip students with no entries at all
      const hasMarks = regularSubjects.some((sub) => (s.marks[sub.name] ?? 0) > 0);
      const hasGrades = creditSubjects.some((sub) => s.grades[sub.name]);
      if (!hasMarks && !hasGrades) continue;
      const success = await saveStudent(s);
      if (success) ok++;
      else fail++;
    }
    setBulkSaving(false);
    if (fail === 0) toast.success(`Saved marks for ${ok} student${ok === 1 ? "" : "s"}`);
    else toast.warning(`Saved ${ok}, failed ${fail}`);
  };

  const persistRemarks = async (student: Student, row: RemarksRow) => {
    const remarksData = {
      class: selectedClass,
      term: currentTerm,
      gr_no: student.grNo,
      student_name: student.name,
      remarks: row.remarks,
      teacher_signature: row.teacherSignature,
      principal_signature: row.principalSignature,
      entered_by_mobile: userMobile || null,
    };

    const { error } = await supabase
      .from("student_term_remarks")
      .upsert(remarksData, { onConflict: "class,term,gr_no" });
    if (error) {
      console.error(error);
      toast.error(`Could not save remarks for ${student.name}`);
    } else {
      setSavedAt(new Date().toLocaleTimeString());
    }
  };

  const updateRemark = (student: Student, field: keyof RemarksRow, value: string) => {
    const current = remarksByGr[student.grNo] || { remarks: "", teacherSignature: "", principalSignature: "" };
    const next = { ...current, [field]: value };
    setRemarksByGr((prev) => ({ ...prev, [student.grNo]: next }));
  };

  const getNumericTotal = (m: Record<string, number>) => computeTotal(m, regularSubjects);
  const getNumericPct = (m: Record<string, number>) => computePercentage(m, regularSubjects);

  const previewStudent = students.find((s) => s.grNo === previewGrNo);
  const activeStudent = students[activeIdx];

  const inputCls =
    "w-14 h-9 text-center bg-background border-2 border-primary/30 rounded-md font-semibold text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50";
  const selectCls =
    "h-9 px-2 bg-background border-2 border-accent rounded-md font-bold text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer disabled:opacity-50";

  return (
    <div className="mt-10 report-card p-6 shadow-2xl rounded-xl print:shadow-none">
      <DunnesHeader />

      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b-2 border-primary/30 -mx-6 px-6 py-3 mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 text-sm font-bold text-primary">
          <span>CLASS: {selectedClass}</span>
          <span>•</span>
          <span>TERM: {currentTerm}</span>
          <span>•</span>
          <span>{students.length} students</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border-2 border-primary">
            <button
              onClick={() => setViewMode("single")}
              className={`px-3 py-1.5 text-xs font-bold ${viewMode === "single" ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}
            >
              ONE STUDENT
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 text-xs font-bold ${viewMode === "all" ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}
            >
              FULL TABLE
            </button>
          </div>
          <button
            onClick={saveAll}
            disabled={loading || bulkSaving}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-bold text-sm shadow-md hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {bulkSaving ? "Saving…" : "💾 SAVE ALL MARKS"}
          </button>
        </div>
      </div>

      {classTeacher && (
        <div className="mb-4 text-xs text-muted-foreground flex justify-between">
          <span>
            Class Teacher: <strong>{classTeacher}</strong>
          </span>
          <span className="text-primary font-semibold">
            {loading
              ? "Loading from cloud…"
              : savingKey || bulkSaving
                ? "Saving…"
                : savedAt
                  ? `✓ Saved at ${savedAt}`
                  : "✓ Loaded from cloud"}
          </span>
        </div>
      )}

      {/* SINGLE STUDENT MODE */}
      {viewMode === "single" && activeStudent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-primary/5 border border-primary/30 rounded-lg p-3">
            <button
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
              className="px-3 py-1.5 bg-background border border-primary rounded font-bold text-primary text-sm disabled:opacity-30"
            >
              ← Prev
            </button>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Student {activeIdx + 1} of {students.length}
              </div>
              <div className="font-black text-lg text-primary uppercase">{activeStudent.name}</div>
              <div className="text-xs text-muted-foreground">GR No: {activeStudent.grNo} • Roll: {activeStudent.rollNo}</div>
            </div>
            <button
              onClick={() => setActiveIdx((i) => Math.min(students.length - 1, i + 1))}
              disabled={activeIdx >= students.length - 1}
              className="px-3 py-1.5 bg-background border border-primary rounded font-bold text-primary text-sm disabled:opacity-30"
            >
              Next →
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Jump to:</span>
            <select
              value={activeIdx}
              onChange={(e) => setActiveIdx(Number(e.target.value))}
              className="border border-primary/30 rounded px-2 py-1 bg-background"
            >
              {students.map((s, i) => (
                <option key={s.grNo} value={i}>
                  {i + 1}. {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-2 border-primary/30 rounded-lg p-4">
            <h3 className="font-bold text-primary uppercase text-sm mb-3">📘 Regular Subjects (out of {MAX_MARKS}, pass = {PASSING_MARKS})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {regularSubjects.map((sub) => {
                const v = activeStudent.marks[sub.name] || 0;
                const fail = v > 0 && v < PASSING_MARKS;
                return (
                  <label key={sub.name} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase">{sub.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={MAX_MARKS}
                      value={activeStudent.marks[sub.name] || ""}
                      onChange={(e) => updateMark(activeStudent.grNo, sub, Number(e.target.value))}
                      disabled={loading}
                      placeholder="0"
                      className={inputCls + " w-full " + (fail ? "border-destructive text-destructive" : "")}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-2 border-accent rounded-lg p-4 bg-accent/5">
            <h3 className="font-bold text-primary uppercase text-sm mb-3">🎨 Credit Subjects (Grade only)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {creditSubjects.map((sub) => (
                <label key={sub.name} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase">{sub.name}</span>
                  <select
                    value={activeStudent.grades[sub.name] || ""}
                    onChange={(e) => updateGrade(activeStudent.grNo, sub, e.target.value as GradeValue | "")}
                    disabled={loading}
                    className={selectCls + " w-full"}
                  >
                    <option value="">— Select —</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Total</div>
              <div className="text-2xl font-black text-primary">{getNumericTotal(activeStudent.marks)}</div>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Percentage</div>
              <div className="text-2xl font-black text-primary">{getNumericPct(activeStudent.marks).toFixed(1)}%</div>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Grade</div>
              <div className="text-2xl font-black text-primary">{getGrade(getNumericPct(activeStudent.marks))}</div>
            </div>
          </div>

          <div className="border-2 border-primary/30 rounded-lg p-4 space-y-3">
            <h3 className="font-bold text-primary uppercase text-sm">📝 Remarks & Signatures</h3>
            <textarea
              value={(remarksByGr[activeStudent.grNo]?.remarks) || ""}
              onChange={(e) => updateRemark(activeStudent, "remarks", e.target.value)}
              placeholder="Teacher's remarks…"
              rows={3}
              className="w-full p-2 border-2 border-primary/30 rounded-md text-sm focus:border-primary focus:outline-none bg-background"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={(remarksByGr[activeStudent.grNo]?.teacherSignature) || ""}
                onChange={(e) => updateRemark(activeStudent, "teacherSignature", e.target.value)}
                placeholder="Teacher signature"
                className="p-2 border-2 border-primary/30 rounded-md text-sm focus:border-primary focus:outline-none bg-background"
              />
              <input
                type="text"
                value={(remarksByGr[activeStudent.grNo]?.principalSignature) || ""}
                onChange={(e) => updateRemark(activeStudent, "principalSignature", e.target.value)}
                placeholder="Principal signature"
                className="p-2 border-2 border-primary/30 rounded-md text-sm focus:border-primary focus:outline-none bg-background"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setPreviewGrNo(previewGrNo === activeStudent.grNo ? "" : activeStudent.grNo)}
              className="px-4 py-2 border-2 border-primary text-primary font-bold rounded-md text-sm hover:bg-primary/10"
            >
              {previewGrNo === activeStudent.grNo ? "Hide Result Card" : "👁 Preview Result Card"}
            </button>
            <button
              onClick={async () => {
                const ok = await saveStudent(activeStudent);
                if (ok) toast.success(`Saved ${activeStudent.name}`);
              }}
              disabled={loading || !!savingKey}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-bold text-sm shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {savingKey === activeStudent.grNo ? "Saving…" : "💾 Save This Student"}
            </button>
          </div>
        </div>
      )}

      {/* FULL TABLE MODE */}
      {viewMode === "all" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-primary text-xs">
            <thead>
              <tr className="bg-primary text-primary-foreground text-[10px]">
                <th className="border border-primary/50 p-2">SR</th>
                <th className="border border-primary/50 p-2">GR NO</th>
                <th className="border border-primary/50 p-2 text-left">STUDENT NAME</th>
                {regularSubjects.map((sub) => (
                  <th key={sub.name} className="border border-primary/50 p-2 uppercase text-[9px]">
                    {sub.name}
                  </th>
                ))}
                {creditSubjects.map((sub) => (
                  <th key={sub.name} className="border border-primary/50 p-2 uppercase text-[9px] bg-accent/40">
                    {sub.name}
                  </th>
                ))}
                <th className="border border-primary/50 p-2">TOTAL</th>
                <th className="border border-primary/50 p-2">%</th>
                <th className="border border-primary/50 p-2">GRADE</th>
                <th className="border border-primary/50 p-2 min-w-[10rem]">REMARKS</th>
                <th className="border border-primary/50 p-2">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => {
                const total = getNumericTotal(student.marks);
                const pct = getNumericPct(student.marks);
                const remarkRow = remarksByGr[student.grNo] || {
                  remarks: "",
                  teacherSignature: "",
                  principalSignature: "",
                };
                return (
                  <tr key={student.grNo} className="hover:bg-primary/5 transition">
                    <td className="border border-primary/30 p-1 text-center text-[10px]">{idx + 1}</td>
                    <td className="border border-primary/30 p-1 text-center font-bold text-[10px]">{student.grNo}</td>
                    <td className="border border-primary/30 p-2 uppercase font-semibold text-[10px] whitespace-nowrap">
                      {student.name}
                    </td>

                    {regularSubjects.map((sub) => (
                      <td key={sub.name} className="border border-primary/30 p-1 text-center">
                        <input
                          type="number"
                          min={0}
                          max={MAX_MARKS}
                          value={student.marks[sub.name] || ""}
                          onChange={(e) => updateMark(student.grNo, sub, Number(e.target.value))}
                          disabled={loading}
                          placeholder="0"
                          className="w-12 h-8 text-center border border-primary/40 rounded bg-background font-medium text-[11px] focus:border-primary focus:outline-none"
                        />
                      </td>
                    ))}

                    {creditSubjects.map((sub) => (
                      <td key={sub.name} className="border border-primary/30 p-1 text-center bg-accent/10">
                        <select
                          value={student.grades[sub.name] || ""}
                          onChange={(e) => updateGrade(student.grNo, sub, e.target.value as GradeValue | "")}
                          disabled={loading}
                          className="h-8 px-1 text-[11px] font-bold border border-accent rounded bg-background focus:border-primary focus:outline-none cursor-pointer"
                        >
                          <option value="">—</option>
                          {GRADE_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}

                    <td className="border border-primary/30 p-2 text-center font-bold">{total}</td>
                    <td className="border border-primary/30 p-2 text-center font-semibold">{pct.toFixed(1)}</td>
                    <td className="border border-primary/30 p-2 text-center font-black text-primary">
                      {getGrade(pct)}
                    </td>

                    <td className="border border-primary/30 p-1">
                      <textarea
                        value={remarkRow.remarks}
                        onChange={(e) => updateRemark(student, "remarks", e.target.value)}
                        placeholder="Remarks…"
                        rows={2}
                        className="w-full text-[10px] p-1 border border-primary/30 rounded bg-background resize-y min-h-[2.5rem] focus:border-primary focus:outline-none"
                      />
                    </td>

                    <td className="border border-primary/30 p-1 text-center">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={async () => {
                            const ok = await saveStudent(student);
                            if (ok) toast.success(`Saved ${student.name}`);
                          }}
                          disabled={loading || !!savingKey}
                          className="text-[10px] font-bold px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingKey === student.grNo ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => setPreviewGrNo(previewGrNo === student.grNo ? "" : student.grNo)}
                          className="text-[10px] font-bold text-primary hover:underline"
                        >
                          {previewGrNo === student.grNo ? "Hide" : "View"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-[10px] text-muted-foreground italic">
        Tip: Numeric marks are out of {MAX_MARKS}. Credit subjects accept a grade only. Click <b>SAVE ALL MARKS</b> at the
        top to push every student's data, or use the per-student Save button.
      </div>

      <div className="mt-10 flex justify-between px-4 print:hidden">
        <div className="text-center">
          <img src={signature} alt="Principal Signature" className="h-12 mx-auto mb-1 opacity-70" />
          <div className="border-t border-foreground text-[10px] pt-1 w-32 font-bold uppercase">Principal</div>
        </div>
        <div className="text-center">
          <div className="h-12 mb-1" />
          <div className="border-t border-foreground text-[10px] pt-1 w-32 font-bold uppercase">
            {classTeacher || "Class Teacher"}
          </div>
        </div>
      </div>

      {previewStudent && (
        <div className="mt-10">
          <ResultCard
            student={previewStudent}
            className={selectedClass}
            term={currentTerm}
            onTermChange={setCurrentTerm}
            classTeacher={classTeacher}
            regularSubjects={regularSubjects}
            creditSubjects={creditSubjects}
            remarks={remarksByGr[previewStudent.grNo]?.remarks || ""}
            teacherSignature={remarksByGr[previewStudent.grNo]?.teacherSignature || ""}
            principalSignature={remarksByGr[previewStudent.grNo]?.principalSignature || ""}
          />
        </div>
      )}
    </div>
  );
};

export default MarksheetEntry;
