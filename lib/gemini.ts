/// <reference types="vite/client" />
/**
 * Extract text from images using a vision model (Gemini 3 Flash via OpenRouter).
 * Set VITE_OPENROUTER_API_KEY in .env. Get key from https://openrouter.ai/keys
 * Model: google/gemini-3-flash-preview
 */

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const VISION_MODEL = 'google/gemini-3-flash-preview';

function fileToBase64DataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function isGeminiConfigured(): boolean {
  return !!OPENROUTER_API_KEY;
}

/**
 * Send image to OpenRouter (Gemini 3 Flash) and get extracted text.
 */
export async function extractTextFromImage(
  file: File,
  prompt: string = 'Extract and return ALL text visible in this image. Preserve structure (e.g. line breaks). Return only the extracted text, no explanation.'
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not set. Add VITE_OPENROUTER_API_KEY to .env (get one at https://openrouter.ai/keys)');
  }
  const dataUrl = await fileToBase64DataUrl(file);
  const body = {
    model: VISION_MODEL,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: prompt },
          { type: 'image_url' as const, image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.1,
  };
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message ?? err?.message ?? `OpenRouter error: ${res.status}`;
    throw new Error(msg);
  }
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (text == null) {
    throw new Error('No text in model response');
  }
  return String(text).trim();
}
