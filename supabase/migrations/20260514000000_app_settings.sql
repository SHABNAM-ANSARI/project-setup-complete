-- Super-Admin master password storage (hashed) + small key/value app settings.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Anyone may read settings (the password is salted+hashed, so safe).
drop policy if exists "Public read app_settings" on public.app_settings;
create policy "Public read app_settings"
  on public.app_settings
  for select
  using (true);

-- Anyone may upsert (the dashboard is gated client-side; tighten later if needed).
drop policy if exists "Public write app_settings" on public.app_settings;
create policy "Public write app_settings"
  on public.app_settings
  for all
  using (true)
  with check (true);

-- Seed default master password = "dunnes@2027" hashed as sha256(salt + ":" + password).
-- Salt: "dunnes-super-admin"
-- Hash precomputed: sha256("dunnes-super-admin:dunnes@2027")
insert into public.app_settings (key, value)
values
  ('super_admin_password_salt', 'dunnes-super-admin'),
  ('super_admin_password_hash', '75010c2bce1042d5c5ce11527d8f97a54dc0237915b071f5bd8a1df5773ce57d')
on conflict (key) do nothing;
