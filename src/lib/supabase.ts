// External Supabase client — points to the user's own Supabase project.
// This bypasses the Lovable Cloud auto-generated client.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iivqizldfsvpekcggxut.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdnFpemxkZnN2cGVrY2dneHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTQ3NjAsImV4cCI6MjA5MTY3MDc2MH0.tCdIFMs2gfjAnBsJVNkKeyRLKEO6DOluflqNkJA6iPA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
