-- Table: scheduled_notifications
-- Used by Super Admin to schedule messages to loan recipients (PWA in-app + SMS fallback).
-- A cron job or Edge Function should run periodically and process rows where schedule_at <= now() and sent_at IS NULL.

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL CHECK (target IN ('all', 'active', 'completed')),
  message TEXT NOT NULL,
  schedule_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  error_log TEXT
);

COMMENT ON TABLE public.scheduled_notifications IS 'Admin-scheduled messages to loan recipients; processor sends via PWA push or SMS.';
COMMENT ON COLUMN public.scheduled_notifications.target IS 'all | active | completed - which loan recipients to target';
COMMENT ON COLUMN public.scheduled_notifications.sent_at IS 'When the batch was processed (null = pending)';
COMMENT ON COLUMN public.scheduled_notifications.sent_count IS 'Number of recipients actually notified';
COMMENT ON COLUMN public.scheduled_notifications.error_log IS 'Optional log of send errors';

-- Optional: index for the scheduler to find due notifications quickly
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
  ON public.scheduled_notifications (schedule_at)
  WHERE sent_at IS NULL;

-- RLS: restrict to authenticated users (adjust to your auth role for super_admin only if needed)
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated"
  ON public.scheduled_notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated"
  ON public.scheduled_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated"
  ON public.scheduled_notifications FOR UPDATE
  TO authenticated
  USING (true);
