// Super-Admin auth — single master password stored hashed in `app_settings`.
// Salt + SHA-256 via Web Crypto. Session is local-only (sessionStorage).
import { supabase } from "@/lib/supabase";

const SESSION_KEY = "super_admin_session_v1";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8h

const KEY_SALT = "super_admin_password_salt";
const KEY_HASH = "super_admin_password_hash";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function loadHashAndSalt(): Promise<{ salt: string; hash: string } | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", [KEY_SALT, KEY_HASH]);
  if (error || !data) return null;
  const map: Record<string, string> = {};
  for (const r of data) map[r.key] = r.value;
  if (!map[KEY_SALT] || !map[KEY_HASH]) return null;
  return { salt: map[KEY_SALT], hash: map[KEY_HASH] };
}

export async function verifySuperAdminPassword(password: string): Promise<boolean> {
  const cfg = await loadHashAndSalt();
  if (!cfg) return false;
  const candidate = await sha256Hex(`${cfg.salt}:${password}`);
  return candidate === cfg.hash;
}

export async function changeSuperAdminPassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message?: string }> {
  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  const ok = await verifySuperAdminPassword(oldPassword);
  if (!ok) return { ok: false, message: "Current password is incorrect." };

  const cfg = await loadHashAndSalt();
  if (!cfg) return { ok: false, message: "Settings not initialized." };
  const newHash = await sha256Hex(`${cfg.salt}:${newPassword}`);
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: KEY_HASH, value: newHash, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function startSuperAdminSession() {
  if (typeof window === "undefined") return;
  const exp = Date.now() + SESSION_TTL_MS;
  sessionStorage.setItem(SESSION_KEY, String(exp));
}

export function isSuperAdminSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(SESSION_KEY);
  if (!v) return false;
  const exp = Number(v);
  if (!exp || exp < Date.now()) {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
  return true;
}

export function endSuperAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}
