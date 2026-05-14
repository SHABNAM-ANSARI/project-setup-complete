import { supabase } from "@/lib/supabase";

export const DEFAULT_PASSWORD = "Teacher@123";
const EMAIL_DOMAIN = "dunnes.local";

export interface AuthLookup {
  name: string;
  mobile: string;
  isAdmin: boolean;
}

export const normalizeMobile = (m: string) =>
  (m || "").replace(/\D/g, "").replace(/^91/, "").slice(-10);

export const phoneToEmail = (phone: string) =>
  `${normalizeMobile(phone)}@${EMAIL_DOMAIN}`;

/**
 * Look up a mobile number in the Cloud database (admins/teachers).
 */
export const lookupUserByMobile = async (
  mobile: string,
): Promise<AuthLookup | null> => {
  const n = normalizeMobile(mobile);
  if (!n || n.length !== 10) return null;

  const { data: admins } = await supabase.from("admins").select("name, mobile");
  const adminMatch = admins?.find((a) => normalizeMobile(a.mobile) === n);
  if (adminMatch) return { name: adminMatch.name, mobile: n, isAdmin: true };

  const { data: teachers } = await supabase
    .from("teachers")
    .select("name, mobile");
  const teacherMatch = teachers?.find((t) => normalizeMobile(t.mobile) === n);
  if (teacherMatch) return { name: teacherMatch.name, mobile: n, isAdmin: false };

  return null;
};

export type SignInResult =
  | { status: "ok"; mustChangePassword: boolean; user: AuthLookup }
  | { status: "not_registered" }
  | { status: "wrong_password" }
  | { status: "error"; message: string };

/**
 * Sign in with phone + password. On first-ever login (no auth user yet) and the
 * password matches the default, the auth user is auto-created.
 */
export const signInWithPhonePassword = async (
  mobile: string,
  password: string,
): Promise<SignInResult> => {
  const lookup = await lookupUserByMobile(mobile);
  if (!lookup) return { status: "not_registered" };

  const email = phoneToEmail(mobile);

  // Try sign-in
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!error && data.user) {
    const mustChange =
      (data.user.user_metadata as any)?.must_change_password === true ||
      password === DEFAULT_PASSWORD;
    return { status: "ok", mustChangePassword: mustChange, user: lookup };
  }

  // If sign-in failed AND user typed the default password, attempt sign-up
  if (password === DEFAULT_PASSWORD) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: DEFAULT_PASSWORD,
      options: {
        data: {
          mobile: lookup.mobile,
          name: lookup.name,
          is_admin: lookup.isAdmin,
          must_change_password: true,
        },
      },
    });

    if (signUpError) {
      // User likely already exists with a different password
      return { status: "wrong_password" };
    }

    if (signUpData.session) {
      return { status: "ok", mustChangePassword: true, user: lookup };
    }

    // Email confirmation may be required — try sign-in again
    const retry = await supabase.auth.signInWithPassword({
      email,
      password: DEFAULT_PASSWORD,
    });
    if (!retry.error && retry.data.user) {
      return { status: "ok", mustChangePassword: true, user: lookup };
    }
    return {
      status: "error",
      message:
        "Account created but email confirmation may be required. Please contact admin.",
    };
  }

  return { status: "wrong_password" };
};

export const changePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  });
  return error ? { ok: false, message: error.message } : { ok: true };
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
