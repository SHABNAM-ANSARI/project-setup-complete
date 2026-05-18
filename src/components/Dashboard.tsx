import { useState } from "react";
import MarksheetEntry from "./MarksheetEntry";
import AdminDashboard from "./AdminDashboard";
import ManageStudents from "./ManageStudents";
import { CLASS_OPTIONS, STUDENTS_BY_CLASS, getTeacherForClass } from "@/data/schoolData";
import { TERM_OPTIONS } from "@/data/subjectMapping";

interface DashboardProps {
  onLogout: () => void;
  userEmail: string;
  isAdmin: boolean;
  userMobile?: string;
  onChangePassword?: () => void;
}

type Mode = "home" | "enter" | "print" | "admin" | "manage";

const Dashboard = ({ onLogout, userEmail, isAdmin, userMobile, onChangePassword }: DashboardProps) => {
  const [mode, setMode] = useState<Mode>("home");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [showEntry, setShowEntry] = useState(false);

  const studentCount = selectedClass ? (STUDENTS_BY_CLASS[selectedClass]?.length || 0) : 0;
  const classTeacher = selectedClass ? getTeacherForClass(selectedClass) : "";

  const goHome = () => {
    setMode("home");
    setShowEntry(false);
    setSelectedClass("");
    setSelectedTerm("");
  };

  return (
    <div className="min-h-screen p-6 bg-background">
      <nav className="flex justify-between items-center mb-8 bg-card p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goHome} className="font-black text-primary text-lg hover:underline">
            DUNNE'S PORTAL
          </button>
          <span className={`text-xs font-bold px-2 py-1 rounded ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {isAdmin ? "ADMIN" : "TEACHER"}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">{userEmail}</span>
        </div>
        <div className="flex items-center gap-3">
          {mode !== "home" && (
            <button onClick={goHome} className="text-primary font-bold text-sm hover:underline">
              ← Home
            </button>
          )}
          {onChangePassword && (
            <button onClick={onChangePassword} className="text-primary font-bold text-sm hover:underline">
              Change Password
            </button>
          )}
          <button onClick={onLogout} className="text-destructive font-bold text-sm hover:underline">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* HOME PAGE */}
        {mode === "home" && (
          <div className="bg-card p-10 rounded-xl shadow-md border border-primary/10">
            <h2 className="text-2xl font-black text-primary mb-2 text-center">Welcome to Dunne's Portal</h2>
            <p className="text-center text-muted-foreground mb-8 text-sm">Choose what you'd like to do</p>

            <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"} gap-6 max-w-4xl mx-auto`}>
              <button
                onClick={() => setMode("enter")}
                className="group p-8 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all shadow-md hover:shadow-xl"
              >
                <div className="text-5xl mb-3">✏️</div>
                <div className="font-black text-xl mb-1">Enter Marks</div>
                <div className="text-xs opacity-80 group-hover:opacity-100">
                  Select a class and term, then enter marks & grades for each student.
                </div>
              </button>

              <button
                onClick={() => setMode("print")}
                className="group p-8 rounded-xl border-2 border-accent bg-accent/10 hover:bg-accent hover:text-accent-foreground transition-all shadow-md hover:shadow-xl"
              >
                <div className="text-5xl mb-3">🖨️</div>
                <div className="font-black text-xl mb-1">Print Result</div>
                <div className="text-xs opacity-80 group-hover:opacity-100">
                  View saved marks and print result cards (A4 landscape, one page).
                </div>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setMode("admin")}
                  className="group p-8 rounded-xl border-2 border-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-all shadow-md hover:shadow-xl"
                >
                  <div className="text-5xl mb-3">🛠</div>
                  <div className="font-black text-xl mb-1">Admin Dashboard</div>
                  <div className="text-xs opacity-80 group-hover:opacity-100">
                    Manage students and enter marks per student, saved directly to the cloud.
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ADMIN DASHBOARD */}
        {mode === "admin" && <AdminDashboard userMobile={userMobile} />}

        {/* SELECT CLASS / TERM (used by both Enter & Print) */}
        {(mode === "enter" || mode === "print") && (
          <div className="bg-card p-8 rounded-xl shadow-md border border-primary/10">
            <h2 className="text-xl font-bold text-primary mb-6">
              {mode === "enter" ? "✏️ Enter Marks" : "🖨️ Print Result Cards"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-bold text-foreground text-sm">Select Class:</label>
                <select
                  className="input-field"
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setShowEntry(false);
                  }}
                >
                  <option value="">Choose Class...</option>
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-2 font-bold text-foreground text-sm">Select Term:</label>
                <select
                  className="input-field"
                  value={selectedTerm}
                  onChange={(e) => {
                    setSelectedTerm(e.target.value);
                    setShowEntry(false);
                  }}
                >
                  <option value="">Choose Term...</option>
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedClass && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg text-sm">
                <span className="font-bold text-primary">Students: {studentCount}</span>
                {classTeacher && <span className="ml-4 text-muted-foreground">Class Teacher: <strong>{classTeacher}</strong></span>}
              </div>
            )}

            <button
              onClick={() => selectedClass && selectedTerm && setShowEntry(true)}
              disabled={!selectedClass || !selectedTerm}
              className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === "enter" ? "Open Marks Entry" : "Open Result Cards"}
            </button>
          </div>
        )}

        {showEntry && (mode === "enter" || mode === "print") && (
          <MarksheetEntry
            selectedClass={selectedClass}
            selectedTerm={selectedTerm}
            userMobile={userMobile}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
