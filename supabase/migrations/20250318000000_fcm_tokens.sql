-- Store FCM (Firebase Cloud Messaging) tokens for push notifications.
-- Each row = one device/browser token for a user (auth.users.id).
-- Edge Functions use this table to send multicast notifications via Firebase Admin.

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens (user_id);

COMMENT ON TABLE public.fcm_tokens IS 'FCM device tokens for push notifications; used by Edge Functions to send via Firebase Admin.';

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
CREATE POLICY "Users can read own fcm tokens"
  ON public.fcm_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fcm tokens"
  ON public.fcm_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fcm tokens"
  ON public.fcm_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own fcm tokens"
  ON public.fcm_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (Edge Function) needs to read all for sending
CREATE POLICY "Service role can read all fcm tokens"
  ON public.fcm_tokens FOR SELECT
  TO service_role
  USING (true);
