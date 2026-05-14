CREATE TABLE IF NOT EXISTS public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gr_no TEXT NOT NULL,
  class_name TEXT NOT NULL,
  name TEXT NOT NULL,
  roll_no TEXT,
  division TEXT,
  gender TEXT,
  dob DATE,
  parent_name TEXT,
  contact TEXT,
  address TEXT,
  exam_year TEXT DEFAULT '2026-27',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gr_no, class_name)
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Anyone can insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete students" ON public.students FOR DELETE USING (true);

CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);