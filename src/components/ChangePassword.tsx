import { useState } from "react";
import DunnesHeader from "./DunnesHeader";
import { changePassword, DEFAULT_PASSWORD } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  forced?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

const ChangePassword = ({ forced, onDone, onCancel }: Props) => {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (pw1.length < 6) return toast.error("Password must be at least 6 characters.");
    if (pw1 !== pw2) return toast.error("Passwords do not match.");
    if (pw1 === DEFAULT_PASSWORD)
      return toast.error("Please choose a password different from the default.");
    setLoading(true);
    const res = await changePassword(pw1);
    setLoading(false);
    if (!res.ok) return toast.error(res.message || "Could not update password.");
    toast.success("Password updated.");
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4">
      <div className="bg-card p-10 rounded-2xl shadow-2xl w-[420px] border-t-8 border-primary">
        <DunnesHeader />
        <div className="space-y-4">
          <p className="text-center font-bold text-muted-foreground text-sm">
            {forced ? "SET A NEW PASSWORD" : "CHANGE PASSWORD"}
          </p>
          {forced && (
            <p className="text-xs text-center text-destructive">
              You are using the default password. Please set a new one to continue.
            </p>
          )}
          <input
            type="password"
            placeholder="New password"
            className="input-field"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            className="input-field"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && submit()}
            disabled={loading}
          />
          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {loading ? "Saving…" : "Update Password"}
          </button>
          {!forced && onCancel && (
            <button
              onClick={onCancel}
              className="w-full text-muted-foreground text-sm hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
