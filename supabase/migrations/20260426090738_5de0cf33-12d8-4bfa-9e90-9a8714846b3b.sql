-- Add grade column (for credit subjects) and remarks column to marks table
ALTER TABLE public.marks ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.marks ALTER COLUMN marks DROP NOT NULL;
ALTER TABLE public.marks ALTER COLUMN marks SET DEFAULT NULL;

-- Create unique index for upsert key (class_name, term, gr_no, subject)
CREATE UNIQUE INDEX IF NOT EXISTS marks_unique_entry
  ON public.marks (class_name, term, gr_no, subject);

-- New table for term-level remarks (one row per student per term)
CREATE TABLE IF NOT EXISTS public.student_term_remarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name TEXT NOT NULL,
  term TEXT NOT NULL,
  gr_no TEXT NOT NULL,
  student_name TEXT NOT NULL,
  remarks TEXT,
  teacher_signature TEXT,
  principal_signature TEXT,
  entered_by_mobile TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (class_name, term, gr_no)
);

ALTER TABLE public.student_term_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read remarks" ON public.student_term_remarks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert remarks" ON public.student_term_remarks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update remarks" ON public.student_term_remarks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete remarks" ON public.student_term_remarks FOR DELETE USING (true);

CREATE TRIGGER update_student_term_remarks_updated_at
BEFORE UPDATE ON public.student_term_remarks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();