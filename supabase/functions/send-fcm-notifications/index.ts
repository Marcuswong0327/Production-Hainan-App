/**
 * Supabase Edge Function: send FCM push notifications to devices.
 *
 * Uses Firebase Admin SDK (npm:firebase-admin). Requires secret:
 *   FIREBASE_SERVICE_ACCOUNT - JSON string of the service account key from Firebase Console.
 *
 * Request body (JSON):
 *   - user_ids?: string[]  Optional. If omitted, send to all tokens in fcm_tokens.
 *   - title: string         Notification title.
 *   - body: string          Notification body.
 *   - link?: string         Optional URL to open on click (e.g. https://yourapp.com).
 *
 * Example:
 *   POST /functions/v1/send-fcm-notifications
 *   Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY
 *   Body: { "user_ids": ["uuid-1"], "title": "Hello", "body": "Message", "link": "https://app.example.com" }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import * as admin from "npm:firebase-admin@12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // Not initialized yet
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as {
      user_ids?: string[];
      title?: string;
      body?: string;
      link?: string;
    };
    const title = body.title ?? "Notification";
    const bodyText = body.body ?? "";
    const link = body.link ?? undefined;
    const userIds = Array.isArray(body.user_ids) ? body.user_ids : undefined;

    const supabase = getSupabaseAdmin();
    let query = supabase.from("fcm_tokens").select("token");
    if (userIds?.length) {
      query = query.in("user_id", userIds);
    }
    const { data: rows, error: fetchError } = await query;
    if (fetchError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch tokens", detail: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const tokens = (rows ?? []).map((r: { token: string }) => r.token).filter(Boolean);
    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, success: 0, failure: 0, message: "No FCM tokens found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const app = getFirebaseApp();
    const messaging = admin.messaging(app);
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body: bodyText },
      data: link ? { url: link } : undefined,
      webpush: link
        ? { fcmOptions: { link } }
        : undefined,
    };
    const result = await messaging.sendEachForMulticast(message);

    return new Response(
      JSON.stringify({
        sent: tokens.length,
        success: result.successCount,
        failure: result.failureCount,
        responses: result.responses.map((r) => ({
          success: r.success,
          error: r.error?.message ?? null,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
