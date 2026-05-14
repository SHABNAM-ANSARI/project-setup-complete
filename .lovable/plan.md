# Super-Admin Dashboard — Implementation Plan

The project already has an `AdminDashboard` with student CRUD, CSV import for students, class/term filtering, a `ResultCard` for single-student PDF, and a hardcoded master password (`dunnes@2027`). We'll build Super-Admin on top of this, in phases so each step is shippable and testable.

## Open questions (please confirm before I start)

1. **Class filter** — currently the dashboard exposes all class options. Do you want the Super-Admin scope **locked to "7th"** (other classes hidden), or just **default to 7th** with the option to switch?
2. **Master password storage** — store the changeable password as a **hash in a new `app_settings` table** (recommended, secure), or as a **plain entry** in your existing schema?
3. **Bulk class results download** — for the "entire class in one file":
   - **Excel**: one sheet, columns = subjects, rows = students, totals/percentage/grade at the right.
   - **PDF**: either (a) one merged PDF of every student's individual report card, or (b) a single summary table page. Which do you prefer (or both buttons)?
4. **Grade scale** — confirm the grade boundaries to use for auto-calc. Default I'll use unless you say otherwise:
   ```
   ≥90 A+   ≥80 A   ≥70 B+   ≥60 B   ≥50 C+   ≥40 C   ≥33 D   <33 F
   ```

## Phases

### Phase 1 — Super-Admin auth & settings
- New DB table `app_settings` (key/value, RLS) seeded with hashed master password.
- New route `/super-admin` with a dedicated login screen (master password only, separate from teacher/admin login).
- Session stored in `localStorage` (`super_admin_session`) with expiry.
- Settings panel inside the new dashboard to **change master password** (verify old → set new, hashed via Web Crypto SHA-256 + salt).

### Phase 2 — Central data table (view / edit / delete)
- New "All Records" view across `students` and `marks` for class 7 (or all classes per Q1).
- Server-side searchable, sortable table with inline edit + row delete.
- Bulk delete (checkbox selection).
- Confirms via dialog; toasts on success/failure.

### Phase 3 — Bulk marks upload (CSV/Excel)
- Drag-and-drop upload, parses `.csv` and `.xlsx` (using `xlsx` package).
- Expected columns: `gr_no, student_name, subject, term, marks` (plus optional `class_name`, defaults to 7th).
- Pre-import preview table, validation (numeric, max-marks, missing GR), error report with downloadable failed rows.
- Upserts into `marks` keyed on `(gr_no, class_name, subject, term)`.

### Phase 4 — Auto-calc + bulk/single download
- Centralized helper `calcResult(marks[])` → `{ total, outOf, percentage, grade }` used by ResultCard, central table, and exports.
- **Single download** — keeps the existing `ResultCard` PDF; ensure totals/grade come from the helper.
- **Bulk download** — two buttons on the All Records view:
  - **Class Excel** (`xlsx`) — full class marksheet with totals/percentage/grade columns and conditional formatting.
  - **Class PDF** (merged ResultCards via `jspdf` + `html2canvas`, or summary table — per Q3).

## Technical notes
- New deps: `xlsx` (CSV/Excel parse + Excel export), `jspdf` + `html2canvas` (PDF), `bcryptjs` or Web Crypto (password hashing).
- All schema changes via Supabase migrations; data ops (seeding password) via insert.
- New files:
  - `supabase/migrations/<ts>_app_settings.sql`
  - `src/routes/super-admin.tsx`, `src/routes/super-admin/index.tsx` (dashboard layout)
  - `src/components/super-admin/SuperAdminLogin.tsx`, `Settings.tsx`, `RecordsTable.tsx`, `BulkMarksUpload.tsx`, `BulkExport.tsx`
  - `src/lib/superAdminAuth.ts`, `src/lib/grades.ts`, `src/lib/exporters.ts`
- No changes to existing teacher/admin login flow — Super-Admin is parallel.

Reply with answers to the 4 questions (or "use defaults") and I'll start with Phase 1.
