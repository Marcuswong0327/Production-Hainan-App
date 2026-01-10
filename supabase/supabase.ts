import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-53266993`;

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token || publicAnonKey;

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