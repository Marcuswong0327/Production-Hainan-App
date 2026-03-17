// process-scheduled-notifications/index.ts
// Supabase Edge Function: process scheduled_notifications and send real FCM push.
// Resolves loan recipients by target → profiles by email → fcm_tokens → Firebase Admin multicast.
// Run on a schedule (e.g. cron every 5 min) or trigger manually via POST.

import { createClient } from "npm:@supabase/supabase-js@2";
import * as admin from "npm:firebase-admin@12";

const DEFAULT_TITLE = "海南会馆";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function getFirebaseApp(): admin.app.App {
  try {
    return admin.app();
  } catch {
    // not initialized
  }
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw?.trim()) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret");
  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON");
  }
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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
  messaging: admin.messaging.Messaging,
  notification: ScheduledNotification
) {
  const recipients = await getLoanRecipientsForTarget(supabase, notification.target);
  const allTokens: string[] = [];
  const errors: string[] = [];

  for (const recipient of recipients) {
    if (!recipient.email) continue;
    const profile = await getProfileByEmail(supabase, recipient.email);
    if (!profile) continue;
    const tokens = await getFCMTokensForUser(supabase, profile.id);
    allTokens.push(...tokens);
  }

  let sentCount = 0;
  if (allTokens.length > 0) {
    const message: admin.messaging.MulticastMessage = {
      tokens: allTokens,
      notification: {
        title: DEFAULT_TITLE,
        body: notification.message,
      },
    };
    const result = await messaging.sendEachForMulticast(message);
    sentCount = result.successCount;
    result.responses.forEach((r, i) => {
      if (!r.success && r.error) errors.push(`token ${i}: ${r.error.message}`);
    });
  }

  const { error: updateError } = await supabase
    .from("scheduled_notifications")
    .update({
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
      error_log: errors.length ? errors.join("\n") : null,
    })
    .eq("id", notification.id);

  if (updateError) throw updateError;
  return { id: notification.id, sentCount, errors: errors.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  try {
    const supabase = getSupabaseAdmin();
    const due = await getDueNotifications(supabase);
    if (due.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No due notifications" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const app = getFirebaseApp();
    const messaging = admin.messaging(app);
    const results: { id: string; sentCount: number; errors: number }[] = [];

    for (const n of due) {
      const r = await processOneNotification(supabase, messaging, n);
      results.push(r);
    }

    return new Response(
      JSON.stringify({ ok: true, processed: due.length, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
