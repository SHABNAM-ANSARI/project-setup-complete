-- Remove any duplicate rows in marks before adding the constraint (keeps the most recently updated)
DELETE FROM public.marks a
USING public.marks b
WHERE a.id < b.id
  AND a.class_name = b.class_name
  AND a.term = b.term
  AND a.gr_no = b.gr_no
  AND a.subject = b.subject;

ALTER TABLE public.marks
  ADD CONSTRAINT marks_class_term_gr_subject_unique
  UNIQUE (class_name, term, gr_no, subject);

-- Remove duplicates in student_term_remarks before adding the constraint
DELETE FROM public.student_term_remarks a
USING public.student_term_remarks b
WHERE a.id < b.id
  AND a.class_name = b.class_name
  AND a.term = b.term
  AND a.gr_no = b.gr_no;

ALTER TABLE public.student_term_remarks
  ADD CONSTRAINT student_term_remarks_class_term_gr_unique
  UNIQUE (class_name, term, gr_no);