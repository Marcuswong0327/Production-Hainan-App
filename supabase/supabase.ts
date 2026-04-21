import { createClient } from '@supabase/supabase-js';

// Reuse the same env-based config pattern as lib/supabase.ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[supabase/supabase.ts] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (legacy: VITE_SUPABASE_ANON_KEY). ' +
      'Add them to .env to enable API requests.'
  );
}

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : createClient('https://example.supabase.co', 'public-anon-key-not-configured');

// Point at the Supabase Edge Function used by this app.
// Example: https://<project-ref>.supabase.co/functions/v1/make-server-53266993
export const API_URL = supabaseUrl
  ? `${supabaseUrl}/functions/v1/make-server-53266993`
  : '';

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  if (!supabaseUrl || !supabasePublishableKey || !API_URL) {
    throw new Error(
      'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) in your .env file.'
    );
  }

  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token || supabasePublishableKey;

  console.log(`API Request to: ${API_URL}${endpoint}`);
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    console.log(`API Response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error on ${endpoint}:`, errorData);
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    console.error(`Network error on ${endpoint}:`, error);
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error: Unable to connect to server. Please check your internet connection or try again later.');
    }
    throw error;
  }
}