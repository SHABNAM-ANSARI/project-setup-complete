import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Upload, Save, ToggleLeft, Layout, School, KeyRound } from "lucide-react";
import {
  EXTRA_FIELDS,
  savePortalConfig,
  uploadSchoolAsset,
  usePortalConfig,
  type PortalConfig,
  type ReportOrientation,
  type ReportTemplate,
} from "@/lib/portalConfig";
import { SuperAdminSettings } from "./SuperAdminSettings";

const TEMPLATES: { key: ReportTemplate; label: string; desc: string }[] = [
  { key: "standard", label: "Standard Single Page", desc: "Clean 1-page card per student." },
  { key: "multi_term", label: "Multi-Term Detailed", desc: "All 3 terms consolidated per student." },
  { key: "tri_fold", label: "3-Fold Folding Card", desc: "Landscape card split into 3 panels." },
];

export function PortalConfigSettings() {
  const { config, setConfig, loading } = usePortalConfig();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "signature" | null>(null);

  if (loading) return <div className="text-muted-foreground">Loading configuration…</div>;

  const update = <K extends keyof PortalConfig>(section: K, patch: Partial<PortalConfig[K]>) =>
    setConfig({ ...config, [section]: { ...config[section], ...patch } });

  const save = async () => {
    setSaving(true);
    try {
      await savePortalConfig(config);
      toast.success("Configuration saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onAsset = async (e: ChangeEvent<HTMLInputElement>, kind: "logo" | "signature") => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(kind);
    try {
      const url = await uploadSchoolAsset(f, kind);
      update("school", kind === "logo" ? { logoUrl: url } : { signatureUrl: url });
      toast.success(`${kind === "logo" ? "Logo" : "Signature"} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ────── Dynamic Field Toggles ────── */}
      <section className="bg-card border-2 border-border rounded-lg p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <ToggleLeft className="w-5 h-5 text-primary" /> Optional Student Fields
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Turn fields ON to expose them in the Records table, CSV importer, and Result Card.
          Turning OFF hides them everywhere — data is preserved in the database under <code>students.extra</code>.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {EXTRA_FIELDS.map((f) => {
            const on = !!config.fields[f.key];
            return (
              <label
                key={f.key}
                className={`flex items-center justify-between gap-3 p-3 rounded-md border-2 cursor-pointer transition ${
                  on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <div>
                  <div className="font-bold text-sm">{f.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{f.key}</div>
                </div>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => update("fields", { [f.key]: e.target.checked } as never)}
                  className="w-5 h-5 accent-primary"
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* ────── Report Layout ────── */}
      <section className="bg-card border-2 border-border rounded-lg p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Layout className="w-5 h-5 text-primary" /> Report Card Layout
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold block mb-2">Orientation</label>
            <div className="flex gap-2">
              {(["portrait", "landscape"] as ReportOrientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => update("report", { orientation: o })}
                  className={`flex-1 px-4 py-3 rounded-md border-2 font-bold text-sm capitalize ${
                    config.report.orientation === o
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-bold block mb-2">Template</label>
            <select
              className="input-field"
              value={config.report.template}
              onChange={(e) => update("report", { template: e.target.value as ReportTemplate })}
            >
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              {TEMPLATES.find((t) => t.key === config.report.template)?.desc}
            </p>
          </div>
        </div>
      </section>

      {/* ────── White-label Branding ────── */}
      <section className="bg-card border-2 border-border rounded-lg p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <School className="w-5 h-5 text-primary" /> White-Label School Profile
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-bold block mb-1">School Name</label>
            <input
              className="input-field"
              value={config.school.name}
              onChange={(e) => update("school", { name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">Tagline / Foundation</label>
            <input
              className="input-field"
              value={config.school.tagline}
              onChange={(e) => update("school", { tagline: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">Academic Year</label>
            <input
              className="input-field"
              value={config.school.academicYear}
              onChange={(e) => update("school", { academicYear: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-bold block mb-1">Address / Contact Line</label>
            <input
              className="input-field"
              value={config.school.address}
              onChange={(e) => update("school", { address: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">Principal Display Name</label>
            <input
              className="input-field"
              value={config.school.principalName}
              onChange={(e) => update("school", { principalName: e.target.value })}
            />
          </div>
          <div />

          <div>
            <label className="text-sm font-bold block mb-1">School Logo</label>
            <div className="flex items-center gap-3">
              {config.school.logoUrl ? (
                <img
                  src={config.school.logoUrl}
                  alt="logo"
                  className="w-16 h-16 object-contain bg-muted rounded border"
                />
              ) : (
                <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                  None
                </div>
              )}
              <label className="cursor-pointer bg-secondary text-secondary-foreground px-3 py-2 rounded-md font-bold text-sm inline-flex items-center gap-1 hover:bg-secondary/80">
                <Upload className="w-4 h-4" />
                {uploading === "logo" ? "Uploading…" : "Choose"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAsset(e, "logo")}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold block mb-1">Principal Signature</label>
            <div className="flex items-center gap-3">
              {config.school.signatureUrl ? (
                <img
                  src={config.school.signatureUrl}
                  alt="signature"
                  className="h-16 w-32 object-contain bg-muted rounded border"
                />
              ) : (
                <div className="h-16 w-32 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                  None
                </div>
              )}
              <label className="cursor-pointer bg-secondary text-secondary-foreground px-3 py-2 rounded-md font-bold text-sm inline-flex items-center gap-1 hover:bg-secondary/80">
                <Upload className="w-4 h-4" />
                {uploading === "signature" ? "Uploading…" : "Choose"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAsset(e, "signature")}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-md shadow-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      {/* ────── Master Password (kept here for one-stop settings) ────── */}
      <section className="bg-card border-2 border-border rounded-lg p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-primary" /> Master Password
        </h2>
        <SuperAdminSettings />
      </section>
    </div>
  );
}
