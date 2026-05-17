// Dynamic portal configuration — single JSON blob stored in app_settings.
// Drives: optional student fields (toggle on/off), report-card layout, white-label school info.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type ExtraFieldKey =
  | "parent_name"
  | "mother_name"
  | "address"
  | "dob"
  | "phone"
  | "email";

export const EXTRA_FIELDS: { key: ExtraFieldKey; label: string }[] = [
  { key: "parent_name", label: "Father / Guardian Name" },
  { key: "mother_name", label: "Mother's Name" },
  { key: "address", label: "Address" },
  { key: "dob", label: "Date of Birth" },
  { key: "phone", label: "Phone Number" },
  { key: "email", label: "Email" },
];

export type ReportOrientation = "portrait" | "landscape";
export type ReportTemplate = "standard" | "multi_term" | "tri_fold";

export interface PortalConfig {
  fields: Record<ExtraFieldKey, boolean>;
  report: {
    orientation: ReportOrientation;
    template: ReportTemplate;
  };
  school: {
    name: string;
    tagline: string;
    address: string;
    logoUrl: string;
    signatureUrl: string;
    principalName: string;
    academicYear: string;
  };
}

export const DEFAULT_CONFIG: PortalConfig = {
  fields: {
    parent_name: false,
    mother_name: false,
    address: false,
    dob: false,
    phone: false,
    email: false,
  },
  report: { orientation: "landscape", template: "standard" },
  school: {
    name: "DUNNE'S INSTITUTE",
    tagline: "(Behramgore Anklesaria Education Foundation)",
    address: "Admiralty House, Wodehouse Road, Colaba, Mumbai - 400 005 | Contact: 7020981168",
    logoUrl: "",
    signatureUrl: "",
    principalName: "Principal's Signature",
    academicYear: "2026-27",
  },
};

const KEY = "portal_config";

function merge(raw: unknown): PortalConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PortalConfig>;
  return {
    fields: { ...DEFAULT_CONFIG.fields, ...(r.fields || {}) },
    report: { ...DEFAULT_CONFIG.report, ...(r.report || {}) },
    school: { ...DEFAULT_CONFIG.school, ...(r.school || {}) },
  };
}

export async function loadPortalConfig(): Promise<PortalConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error || !data?.value) return DEFAULT_CONFIG;
  try {
    return merge(JSON.parse(data.value));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function savePortalConfig(cfg: PortalConfig): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: KEY, value: JSON.stringify(cfg), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function uploadSchoolAsset(file: File, kind: "logo" | "signature"): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("school-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
  return data.publicUrl;
}

export function usePortalConfig() {
  const [config, setConfig] = useState<PortalConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const c = await loadPortalConfig();
    setConfig(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, setConfig, loading, reload };
}

export function enabledExtraFields(cfg: PortalConfig): { key: ExtraFieldKey; label: string }[] {
  return EXTRA_FIELDS.filter((f) => cfg.fields[f.key]);
}
