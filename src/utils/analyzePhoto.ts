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

/** Google AI Studio model for generateContent. Older IDs (e.g. gemini-2.0-flash) often have no free-tier quota and return 429. */
const GEMINI_MODEL = 'gemini-2.5-flash';

function geminiGenerateContentUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
}

/** JSON Schema for structured output — avoids truncated free-form JSON with thinking models. */
const GEMINI_PHOTO_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description:
        'Short, specific memory title (max ~60 chars). Vivid, not generic (e.g. "sunset over the ghats" not "sunset").',
    },
    emoji: {
      type: 'string',
      description:
        'Exactly one emoji for the scene (e.g. mountains 🏔️, beach 🌊, food 🍜, city 🏙️).',
    },
    placeDescriptor: {
      type: 'string',
      description:
        'Lowercase sensory phrase (max ~120 chars): feel of the place (e.g. "warm stone steps in afternoon shadow").',
    },
  },
  required: ['title', 'emoji', 'placeDescriptor'],
} as const;

function geminiCandidateText(data: {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
}): { text: string; finishReason?: string } {
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('');
  return { text, finishReason: candidate?.finishReason };
}

function parseDataUrlBase64(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^,]+),([\s\S]+)$/);
  if (!m) return null;
  const meta = m[1];
  const base64 = m[2].replace(/\s/g, '');
  if (!base64) return null;
  const mimeType = meta.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
  return { mimeType, base64 };
}

/** JSON schema for voice memo → single transcript string. */
const GEMINI_TRANSCRIPT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    transcript: {
      type: 'string',
      description:
        'Full transcript of the voice memo, lightly edited for a journal: punctuation, paragraphs, obvious mishearings fixed. No title or preamble.',
    },
  },
  required: ['transcript'],
} as const;

const VOICE_TRANSCRIBE_PROMPT = `Transcribe this voice memo. Lightly edit for a personal journal: add punctuation and paragraph breaks, fix obvious speech-recognition mistakes. Do not invent words or add commentary.`;

function whisperFilename(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (base.includes('webm')) return 'recording.webm';
  if (base.includes('mp4') || base.includes('m4a')) return 'recording.m4a';
  if (base.includes('wav')) return 'recording.wav';
  if (base.includes('mpeg') || base.includes('mp3')) return 'recording.mp3';
  if (base.includes('flac')) return 'recording.flac';
  if (base.includes('ogg')) return 'recording.ogg';
  return 'recording.webm';
}

async function openAiCleanTranscript(raw: string, apiKey: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 8192,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Light-edit this voice memo transcript for a personal journal. Fix punctuation and paragraph breaks; fix obvious ASR errors only. Do not add facts or a preamble. Output only the cleaned text:\n\n${trimmed}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(simplifyAiError(err?.error?.message || `OpenAI error ${res.status}`, res.status));
  }
  const data = await res.json();
  const out = data.choices?.[0]?.message?.content?.trim() ?? '';
  return out || trimmed;
}

function simplifyAiError(message: string, status: number): string {
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes('invalid api key') || lower.includes('api key not valid')) {
    return 'Invalid API key';
  }
  if (status === 429 || lower.includes('quota exceeded') || lower.includes('rate limit')) {
    const retryMatch = message.match(/retry in\s+([\d.]+s?)/i);
    const retry = retryMatch?.[1];
    if (retry) return `Rate limited. Retry in ${retry}`;
    if (/limit:\s*0\b/.test(lower)) {
      return 'No quota for this model on your API key or plan. See ai.google.dev rate limits.';
    }
    return 'Rate limited or quota exceeded. See ai.google.dev/gemini-api/docs/rate-limits';
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
    const res = await fetch(geminiGenerateContentUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          responseJsonSchema: GEMINI_PHOTO_ANALYSIS_JSON_SCHEMA,
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(simplifyAiError(err?.error?.message || `Gemini error ${res.status}`, res.status));
    }
    const data = await res.json();
    const { text, finishReason } = geminiCandidateText(data);
    rawText = text;
    if (!rawText.trim() && finishReason === 'MAX_TOKENS') {
      throw new Error('AI response was cut off. Try again or increase output limit.');
    }
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

/**
 * Transcribe and lightly clean a voice memo (data URL). Gemini: one multimodal call.
 * OpenAI: Whisper then gpt-4o-mini cleanup. Claude: not supported (throws).
 */
export async function transcribeVoiceMemo(
  audioDataUrl: string,
  provider: 'gemini' | 'openai' | 'claude',
  apiKey: string
): Promise<string> {
  const parsed = parseDataUrlBase64(audioDataUrl.trim());
  if (!parsed) throw new Error('Invalid audio data URL');
  if (!apiKey) throw new Error('No API key configured');

  if (provider === 'claude') {
    throw new Error(
      'Voice transcription needs Google Gemini or OpenAI. Change provider in Settings, or remove the voice note to use Claude for photos only.'
    );
  }

  if (provider === 'gemini') {
    const res = await fetch(geminiGenerateContentUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: VOICE_TRANSCRIBE_PROMPT },
              { inlineData: { mimeType: parsed.mimeType, data: parsed.base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseJsonSchema: GEMINI_TRANSCRIPT_JSON_SCHEMA,
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(simplifyAiError(err?.error?.message || `Gemini error ${res.status}`, res.status));
    }
    const data = await res.json();
    const { text, finishReason } = geminiCandidateText(data);
    if (!text.trim() && finishReason === 'MAX_TOKENS') {
      throw new Error('Transcription was cut off. Try a shorter recording or try again.');
    }
    let parsedJson: { transcript?: string };
    try {
      parsedJson = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      throw new Error(`AI returned invalid transcript JSON: ${text.slice(0, 120)}`);
    }
    const t = parsedJson.transcript?.trim() ?? '';
    if (!t) throw new Error('Empty transcription from AI');
    return t;
  }

  // OpenAI: Whisper + light cleanup
  let binary: string;
  try {
    binary = atob(parsed.base64);
  } catch {
    throw new Error('Invalid audio data URL');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: parsed.mimeType.split(';')[0].trim() || 'audio/webm' });
  const formData = new FormData();
  formData.append('file', blob, whisperFilename(parsed.mimeType));
  formData.append('model', 'whisper-1');

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!whisperRes.ok) {
    const err = await whisperRes.json().catch(() => ({}));
    throw new Error(simplifyAiError(err?.error?.message || `Whisper error ${whisperRes.status}`, whisperRes.status));
  }
  const whisperBody = await whisperRes.text();
  let raw = '';
  try {
    const whisperData = JSON.parse(whisperBody) as { text?: string };
    raw = whisperData.text?.trim() ?? '';
  } catch {
    raw = whisperBody.trim();
  }
  if (!raw) throw new Error('Empty transcription from Whisper');
  return openAiCleanTranscript(raw, apiKey);
}

export async function testAiConnection(
  provider: 'gemini' | 'openai' | 'claude',
  apiKey: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (provider === 'gemini') {
      const res = await fetch(geminiGenerateContentUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
