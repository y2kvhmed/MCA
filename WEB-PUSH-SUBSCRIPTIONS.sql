-- Web Push Subscriptions table
-- Stores browser push subscription details for Web Push API (Android Chrome + iOS 16.4+ Home Screen)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS disabled: the app uses a custom app_users table (not Supabase Auth),
-- so auth.uid()-based policies don't apply. Access is controlled app-side.
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
