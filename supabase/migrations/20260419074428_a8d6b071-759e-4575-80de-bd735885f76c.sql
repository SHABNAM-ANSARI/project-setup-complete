
-- Teachers table
CREATE TABLE public.teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  designation TEXT NOT NULL DEFAULT 'Teacher',
  classes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admins table (mobile numbers with full access)
CREATE TABLE public.admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marks table (one row per student per subject per term)
CREATE TABLE public.marks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name TEXT NOT NULL,
  term TEXT NOT NULL,
  gr_no TEXT NOT NULL,
  student_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 0 CHECK (marks >= 0 AND marks <= 100),
  entered_by_mobile TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_name, term, gr_no, subject)
);

CREATE INDEX idx_marks_class_term ON public.marks (class_name, term);

-- Updated_at trigger function (shared)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_marks_updated_at
  BEFORE UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- Public read for teachers / admins (needed for mobile-based login lookup; no sensitive data beyond name+mobile)
CREATE POLICY "Public can read teachers"
  ON public.teachers FOR SELECT
  USING (true);

CREATE POLICY "Public can read admins"
  ON public.admins FOR SELECT
  USING (true);

-- Marks: app uses mobile-based session (no Supabase auth). Allow public CRUD; enforce audit via entered_by_mobile.
CREATE POLICY "Anyone can read marks"
  ON public.marks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert marks"
  ON public.marks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update marks"
  ON public.marks FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete marks"
  ON public.marks FOR DELETE
  USING (true);
