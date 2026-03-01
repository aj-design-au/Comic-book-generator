import { NextResponse } from 'next/server';

const XAI_API_KEY = process.env.XAI_API_KEY;
const POLLINATIONS_MODELS = ['flux', 'turbo'];
const POLLINATIONS_RETRIES = 2;
const TIMEOUT_MS = 45000;

async function fetchWithTimeout(url: string, timeoutMs: number, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Primary: xAI Grok Aurora — high quality, relaxed copyright restrictions
async function tryGrokAurora(prompt: string): Promise<string | null> {
  if (!XAI_API_KEY) return null;

  try {
    const response = await fetchWithTimeout('https://api.x.ai/v1/images/generations', TIMEOUT_MS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt: `${prompt}, comic book art style, high resolution, detailed, vibrant colors`,
        n: 1,
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      console.log(`[image-gen] Grok API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;

    return `data:image/jpeg;base64,${b64}`;
  } catch (err) {
    console.log('[image-gen] Grok request failed:', err);
    return null;
  }
}

// Fallback: Pollinations.ai — free, no auth, but less reliable
async function tryPollinations(prompt: string): Promise<string | null> {
  const enhancedPrompt = `${prompt}, masterpiece, best quality, comic book art, high resolution, detailed`;
  const baseSeed = Math.floor(Math.random() * 1000000);

  for (const model of POLLINATIONS_MODELS) {
    for (let attempt = 0; attempt < POLLINATIONS_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }

      console.log(`[image-gen] Pollinations model=${model} attempt=${attempt + 1}/${POLLINATIONS_RETRIES}`);

      try {
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=1024&height=1024&seed=${baseSeed + attempt}&nologo=true`;
        const response = await fetchWithTimeout(url, TIMEOUT_MS);

        if (!response.ok) continue;

        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) continue;

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 1000) continue;

        const base64 = buffer.toString('base64');
        console.log(`[image-gen] Pollinations success: model=${model} size=${buffer.length} bytes`);
        return `data:image/jpeg;base64,${base64}`;
      } catch {
        continue;
      }
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    // Try Pollinations first (free), then Grok Aurora (paid fallback)
    console.log('[image-gen] Trying Pollinations...');
    let imageUrl = await tryPollinations(prompt);

    if (!imageUrl) {
      console.log('[image-gen] Pollinations failed, trying Grok Aurora fallback...');
      imageUrl = await tryGrokAurora(prompt);
    }

    if (imageUrl) {
      return NextResponse.json({ url: imageUrl });
    }

    console.error('[image-gen] All providers failed');
    return NextResponse.json({ error: 'All image generation attempts failed' }, { status: 502 });

  } catch (error) {
    console.error('[image-gen] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
