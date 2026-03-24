export interface PhotoAnalysis {
  title: string;
  emoji: string;
  placeDescriptor: string;
}

const SYSTEM_PROMPT = `You analyze a photo and return JSON for a personal memory journal.

Return ONLY a valid JSON object with exactly these three fields:

{
  "title": "short specific memory title, max 60 chars. Be vivid and specific.
            Not 'sunset' but 'sunset over the ghats'.
            Not 'food' but 'steaming momos at the mountain stall'.",
  "emoji": "single emoji that best represents this scene or memory.
            Examples: 🏔️ for mountains, 🌊 for beach, 🍜 for food,
            🏛️ for architecture, 🌅 for sunrise/sunset, 🌿 for nature,
            🎉 for celebration, ✈️ for travel, 🏙️ for cityscape.",
  "placeDescriptor": "vivid sensory phrase, max 120 chars.
                      Lowercase, atmospheric, describes the feel of the place.
                      Examples: 'warm stone steps in afternoon shadow',
                      'smell of rain on a dusty road',
                      'narrow alley lit by a single lantern'."
}

No markdown. No backticks. No explanation. Only the JSON object.`;

function simplifyAiError(message: string, status: number): string {
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes('invalid api key') || lower.includes('api key not valid')) {
    return 'Invalid API key';
  }
  if (status === 429 || lower.includes('quota exceeded') || lower.includes('rate limit')) {
    const retryMatch = message.match(/retry in\s+([\d.]+s?)/i);
    const retry = retryMatch?.[1];
    return retry ? `Quota exceeded. Retry in ${retry}` : 'Quota exceeded. Please retry shortly';
  }
  if (status >= 500) return 'AI provider is temporarily unavailable';
  return message || `Error ${status}`;
}

export async function analyzePhoto(
  imageDataUrl: string,
  provider: 'gemini' | 'openai' | 'claude',
  apiKey: string
): Promise<PhotoAnalysis> {
  const base64 = imageDataUrl.split(',')[1];
  const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
  if (!base64) throw new Error('Invalid image data URL');
  if (!apiKey) throw new Error('No API key configured');

  let rawText = '';

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }],
          },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(simplifyAiError(err?.error?.message || `Gemini error ${res.status}`, res.status));
    }
    const data = await res.json();
    rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } else if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        temperature: 0.4,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(simplifyAiError(err?.error?.message || `OpenAI error ${res.status}`, res.status));
    }
    const data = await res.json();
    rawText = data.choices?.[0]?.message?.content ?? '';
  } else {
    const mediaType =
      mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              { type: 'text', text: SYSTEM_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(simplifyAiError(err?.error?.message || `Claude error ${res.status}`, res.status));
    }
    const data = await res.json();
    rawText = data.content?.[0]?.text ?? '';
  }

  if (!rawText) throw new Error('Empty response from AI');
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  let parsed: PhotoAnalysis;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.slice(0, 100)}`);
  }

  if (!parsed.title || !parsed.emoji || !parsed.placeDescriptor) {
    throw new Error('AI response missing required fields');
  }

  parsed.title = parsed.title.slice(0, 60);
  parsed.placeDescriptor = parsed.placeDescriptor.slice(0, 120);
  parsed.emoji = [...parsed.emoji][0] ?? '📍';
  return parsed;
}

export async function testAiConnection(
  provider: 'gemini' | 'openai' | 'claude',
  apiKey: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with the word OK only.' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: simplifyAiError(err?.error?.message || `Error ${res.status}`, res.status) };
      }
      return { ok: true };
    }

    const res =
      provider === 'openai'
        ? await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 5,
              messages: [{ role: 'user', content: 'Reply with OK only.' }],
            }),
          })
        : await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5',
              max_tokens: 5,
              messages: [{ role: 'user', content: [{ type: 'text', text: 'Reply OK only.' }] }],
            }),
          });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: simplifyAiError(err?.error?.message || `Error ${res.status}`, res.status) };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
