import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface StudentRow {
  grNo: string;
  name: string;
  rollNo: string;
  division: string;
  class: string;
}

/**
 * Fetches students dynamically from the Supabase `student_result` table.
 * Columns expected: student_name, gr_no, class, division, roll_no.
 */
export const useStudentsByClass = (selectedClass: string) => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("student_result" as never)
        .select("student_name, gr_no, class, division, roll_no")
        .eq("class", selectedClass)
        .order("roll_no", { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setStudents([]);
      } else {
        const rows = (data ?? []) as Array<{
          student_name: string;
          gr_no: string;
          class: string;
          division: string | null;
          roll_no: string | null;
        }>;
        setStudents(
          rows.map((r, idx) => ({
            grNo: String(r.gr_no ?? ""),
            name: r.student_name ?? "",
            rollNo: r.roll_no ? String(r.roll_no) : String(idx + 1),
            division: r.division ?? "",
            class: r.class ?? "",
          })),
        );
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  return { students, loading, error };
};
