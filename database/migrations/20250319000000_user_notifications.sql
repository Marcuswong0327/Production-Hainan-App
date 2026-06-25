-- In-app notifications (bell icon). Super Admin scheduled messages and other system notifications.
-- Edge Function inserts here when sending FCM; NotificationPanel reads for the current user.

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('event', 'donation', 'loan', 'system')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON public.user_notifications (created_at DESC);

COMMENT ON TABLE public.user_notifications IS 'In-app notifications shown in the bell dropdown; populated by Edge Function when sending scheduled FCM.';

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.user_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications (mark read)"
  ON public.user_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (Edge Function) can insert for any user
CREATE POLICY "Service role can insert user_notifications"
  ON public.user_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);
