import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { changeSuperAdminPassword } from "@/lib/superAdminAuth";

export function SuperAdminSettings() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy(true);
    const res = await changeSuperAdminPassword(oldPw, newPw);
    setBusy(false);
    if (res.ok) {
      toast.success("Master password updated");
      setOldPw("");
      setNewPw("");
      setConfirm("");
    } else {
      toast.error(res.message || "Failed to update password");
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Master Password</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Change the Super-Admin master password. Minimum 8 characters.
      </p>
      <form onSubmit={submit} className="space-y-4 bg-card border-2 border-border rounded-lg p-6">
        <div>
          <label className="text-sm font-bold block mb-1">Current Password</label>
          <input
            type="password"
            className="input-field"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            disabled={busy}
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold block mb-1">New Password</label>
          <input
            type="password"
            className="input-field"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            disabled={busy}
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="text-sm font-bold block mb-1">Confirm New Password</label>
          <input
            type="password"
            className="input-field"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            minLength={8}
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
