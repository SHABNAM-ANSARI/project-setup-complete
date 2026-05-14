import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldAlert } from "lucide-react";
import {
  startSuperAdminSession,
  verifySuperAdminPassword,
} from "@/lib/superAdminAuth";

interface Props {
  onAuthed: () => void;
}

export function SuperAdminLogin({ onAuthed }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const ok = await verifySuperAdminPassword(password);
      if (!ok) {
        setError("Incorrect master password.");
        return;
      }
      startSuperAdminSession();
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      <div className="w-full max-w-md bg-card border-2 border-primary/20 rounded-xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <ShieldAlert className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Super-Admin Access</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Restricted area. Master password required.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">
              Master Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                className="input-field pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                autoFocus
                disabled={busy}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Unlock Dashboard"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary underline">
            ← Back to teacher portal
          </Link>
        </div>
      </div>
    </div>
  );
}
