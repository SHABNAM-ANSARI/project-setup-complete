import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, Settings, Database, Upload, Download } from "lucide-react";
import { CLASS_OPTIONS } from "@/data/schoolData";
import {
  isSuperAdminSessionActive,
  endSuperAdminSession,
} from "@/lib/superAdminAuth";
import { SuperAdminLogin } from "@/components/super-admin/SuperAdminLogin";
import { PortalConfigSettings } from "@/components/super-admin/PortalConfigSettings";
import { RecordsTable } from "@/components/super-admin/RecordsTable";
import { BulkMarksUpload } from "@/components/super-admin/BulkMarksUpload";
import { BulkExport } from "@/components/super-admin/BulkExport";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminPage,
});

type Tab = "records" | "upload" | "export" | "settings";

function SuperAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("records");
  const [className, setClassName] = useState("Class 7");
  const [term, setTerm] = useState("Term 1");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setAuthed(isSuperAdminSessionActive());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!authed) return <SuperAdminLogin onAuthed={() => setAuthed(true)} />;

  const logout = () => {
    endSuperAdminSession();
    setAuthed(false);
  };

  const tabs: { key: Tab; label: string; icon: typeof Database }[] = [
    { key: "records", label: "Records", icon: Database },
    { key: "upload", label: "Bulk Upload", icon: Upload },
    { key: "export", label: "Bulk Export", icon: Download },
    { key: "settings", label: "Configuration", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground border-b-4 border-accent">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Super-Admin Dashboard</h1>
            <p className="text-xs opacity-80">Dunnes Result Portal</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs underline opacity-80 hover:opacity-100">Teacher portal</Link>
            <button
              onClick={logout}
              className="bg-primary-foreground text-primary font-bold px-3 py-1.5 rounded-md text-sm flex items-center gap-1 hover:bg-primary-foreground/90"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab !== "settings" && (
          <div className="flex flex-wrap items-center gap-3 mb-5 bg-card border-2 border-border rounded-lg p-3">
            <label className="text-sm font-bold">Class:</label>
            <select
              className="input-field w-auto"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}{c === "Class 7" ? " ★" : ""}</option>
              ))}
            </select>
            <label className="text-sm font-bold ml-3">Term:</label>
            <select
              className="input-field w-auto"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            >
              <option>Term 1</option>
              <option>Term 2</option>
              <option>Term 3</option>
            </select>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-5 border-b border-border">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 font-bold text-sm flex items-center gap-2 -mb-px border-b-2 ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "records" && (
          <RecordsTable key={`${className}-${term}-${reloadKey}`} className={className} term={term} />
        )}
        {tab === "upload" && (
          <BulkMarksUpload
            defaultClass={className}
            onImported={() => setReloadKey((k) => k + 1)}
          />
        )}
        {tab === "export" && <BulkExport className={className} term={term} />}
        {tab === "settings" && <PortalConfigSettings />}
      </div>
    </div>
  );
}
