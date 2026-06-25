// process-scheduled-notifications/index.ts
// Supabase Edge Function: process scheduled_notifications and send real FCM push.
// Resolves loan recipients by target → profiles by email → fcm_tokens → Firebase Admin multicast.
// Run on a schedule (e.g. cron every 5 min) or trigger manually via POST.
// You only need this function for the schedule flow; send-fcm-notifications is optional (on-demand).

import { createClient } from "npm:@supabase/supabase-js@2";
import { getApps, initializeApp, cert } from "npm:firebase-admin/app";
import { getMessaging } from "npm:firebase-admin/messaging";

const DEFAULT_TITLE = "海南会馆";
const EMAIL_SUBJECT = "海南会馆通知";
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function ensureFirebaseApp() {
  if (getApps().length > 0) return;
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw?.trim()) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret");
  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON");
  }
  initializeApp({ credential: cert(serviceAccount) });
}

type ScheduledNotification = {
  id: string;
  target: "all" | "active" | "completed";
  message: string;
  schedule_at: string;
  created_at: string;
  sent_at: string | null;
};

type LoanRecipient = { id: string; email: string; status: "active" | "completed" };
type Profile = { id: string; email: string };

async function sendResendEmails(toEmails: string[], message: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!apiKey?.trim() || !from?.trim()) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM secret");
  }
  if (toEmails.length === 0) return { sent: 0, errors: [] as string[] };

  const errors: string[] = [];
  let sent = 0;

  for (const to of toEmails) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: EMAIL_SUBJECT,
          text: message,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        errors.push(`email ${to}: ${json?.message || json?.error || `HTTP ${res.status}`}`);
      } else {
        sent += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`email ${to}: ${msg}`);
    }
  }

  return { sent, errors };
}

async function getDueNotifications(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("scheduled_notifications")
    .select("*")
    .is("sent_at", null)
    .lte("schedule_at", new Date().toISOString());
  if (error) throw error;
  return (data ?? []) as ScheduledNotification[];
}

async function getLoanRecipientsForTarget(
  supabase: ReturnType<typeof createClient>,
  target: ScheduledNotification["target"]
) {
  let query = supabase.from("study_loan_recipients").select("id, email, status");
  if (target === "active") query = query.eq("status", "active");
  else if (target === "completed") query = query.eq("status", "completed");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LoanRecipient[];
}

async function getProfileByEmail(supabase: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (error) return null;
  return (data as Profile | null) ?? null;
}

async function getFCMTokensForUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r: { token: string }) => r.token).filter(Boolean);
}

async function processOneNotification(
  supabase: ReturnType<typeof createClient>,
  notification: ScheduledNotification
) {
  const recipients = await getLoanRecipientsForTarget(supabase, notification.target);
  const allTokens: string[] = [];
  const userIdsToNotify = new Set<string>();
  const errors: string[] = [];

  // Email recipients are based on the loan recipients list (deduped)
  const emailSet = new Set<string>();

  for (const recipient of recipients) {
    if (!recipient.email) continue;
    emailSet.add(recipient.email.trim());
    const profile = await getProfileByEmail(supabase, recipient.email);
    if (!profile) continue;
    const tokens = await getFCMTokensForUser(supabase, profile.id);
    if (tokens.length > 0) userIdsToNotify.add(profile.id);
    allTokens.push(...tokens);
  }

  // Send email (independent of FCM tokens)
  const emailList = Array.from(emailSet).filter((e) => e.length > 0);
  let emailSent = 0;
  try {
    const emailResult = await sendResendEmails(emailList, notification.message);
    emailSent = emailResult.sent;
    if (emailResult.errors.length) {
      errors.push(...emailResult.errors);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`email: ${msg}`);
  }

  let sentCount = 0;
  if (allTokens.length > 0) {
    const messaging = getMessaging();
    const result = await messaging.sendEachForMulticast({
      tokens: allTokens,
      notification: {
        title: DEFAULT_TITLE,
        body: notification.message,
      },
    });
    sentCount = result.successCount;
    result.responses.forEach((r, i) => {
      if (!r.success && r.error) errors.push(`token ${i}: ${r.error.message}`);
    });
  }

  // Insert in-app notification (bell icon) for each user who received the FCM
  for (const uid of userIdsToNotify) {
    await supabase.from("user_notifications").insert({
      user_id: uid,
      title: DEFAULT_TITLE,
      message: notification.message,
      type: "system",
      read: false,
    });
  }

  const { error: updateError } = await supabase
    .from("scheduled_notifications")
    .update({
      sent_at: new Date().toISOString(),
      // sent_count tracks successful push deliveries (tokens). Email count is included in error_log summary.
      sent_count: sentCount,
      error_log: [
        `email_sent=${emailSent}/${emailList.length}`,
        errors.length ? errors.join("\n") : "",
      ].filter(Boolean).join("\n") || null,
    })
    .eq("id", notification.id);

  if (updateError) throw updateError;
  return { id: notification.id, sentCount, errors: errors.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const due = await getDueNotifications(supabase);
    if (due.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No due notifications" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    ensureFirebaseApp();
    const results: { id: string; sentCount: number; errors: number }[] = [];

    for (const n of due) {
      const r = await processOneNotification(supabase, n);
      results.push(r);
    }

    return new Response(
      JSON.stringify({ ok: true, processed: due.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
