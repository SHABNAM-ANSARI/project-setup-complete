import { useState } from "react";
import DunnesHeader from "./DunnesHeader";
import { signInWithPhonePassword, DEFAULT_PASSWORD } from "@/lib/auth";
import { toast } from "sonner";

interface LoginViewProps {
  onLogin: (user: {
    mobile: string;
    name: string;
    isAdmin: boolean;
    mustChangePassword: boolean;
  }) => void;
}

const LoginView = ({ onLogin }: LoginViewProps) => {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!mobile.trim()) return setError("Please enter your mobile number.");
    if (!password) return setError("Please enter your password.");
    setLoading(true);
    try {
      const res = await signInWithPhonePassword(mobile.trim(), password);
      if (res.status === "not_registered") {
        setError("This mobile number is not registered. Access denied.");
        toast.error("Login blocked: number not in database.");
      } else if (res.status === "wrong_password") {
        setError("Incorrect password.");
        toast.error("Wrong password.");
      } else if (res.status === "error") {
        setError(res.message);
        toast.error(res.message);
      } else {
        toast.success(`Welcome ${res.user.name}${res.user.isAdmin ? " (Admin)" : ""}`);
        onLogin({
          mobile: res.user.mobile,
          name: res.user.name,
          isAdmin: res.user.isAdmin,
          mustChangePassword: res.mustChangePassword,
        });
      }
    } catch (e) {
      console.error(e);
      setError("Could not verify right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4">
      <div className="bg-card p-10 rounded-2xl shadow-2xl w-[420px] border-t-8 border-primary">
        <DunnesHeader />
        <div className="space-y-4">
          <p className="text-center font-bold text-muted-foreground text-sm">
            TEACHER PORTAL LOGIN
          </p>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Registered Mobile Number"
            className="input-field"
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value);
              setError("");
            }}
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            className="input-field"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
            disabled={loading}
          />
          {error && (
            <p className="text-destructive text-sm font-semibold text-center">{error}</p>
          )}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Login"}
          </button>
          <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-[11px] text-muted-foreground space-y-1">
            <p>
              <strong>First time?</strong> Use the default password:{" "}
              <code className="bg-background px-1.5 py-0.5 rounded font-mono text-primary">
                {DEFAULT_PASSWORD}
              </code>
            </p>
            <p>You'll be asked to set your own password right after login.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
