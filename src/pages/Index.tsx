import { useEffect, useState } from "react";
import LoginView from "@/components/LoginView";
import Dashboard from "@/components/Dashboard";
import ChangePassword from "@/components/ChangePassword";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

interface AuthUser {
  mobile: string;
  name: string;
  isAdmin: boolean;
}

const STORAGE_KEY = "dunnes_auth_user";

const Index = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mustChange, setMustChange] = useState(false);
  const [showChange, setShowChange] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore cached profile + verify session
    const raw = localStorage.getItem(STORAGE_KEY);
    const cached = raw ? (JSON.parse(raw) as AuthUser) : null;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && cached) {
        setUser(cached);
        const meta = data.session.user.user_metadata as any;
        if (meta?.must_change_password) setMustChange(true);
      }
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setMustChange(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = (u: AuthUser & { mustChangePassword: boolean }) => {
    const { mustChangePassword, ...profile } = u;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setUser(profile);
    setMustChange(mustChangePassword);
  };

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setMustChange(false);
  };

  if (!ready) return null;
  if (!user) return <LoginView onLogin={handleLogin} />;
  if (mustChange)
    return <ChangePassword forced onDone={() => setMustChange(false)} />;
  if (showChange)
    return (
      <ChangePassword
        onDone={() => setShowChange(false)}
        onCancel={() => setShowChange(false)}
      />
    );

  return (
    <Dashboard
      onLogout={handleLogout}
      userEmail={`${user.name} (${user.mobile})`}
      isAdmin={user.isAdmin}
      userMobile={user.mobile}
      onChangePassword={() => setShowChange(true)}
    />
  );
};

export default Index;
