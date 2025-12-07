import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    // Enhance prompt for Pollinations/Stable Diffusion
    // We add specific keywords to help SD models understand the style better than DALL-E
    const enhancedPrompt = `${prompt}, masterpiece, best quality, comic book art, high resolution, detailed`;
    
    // Pollinations.ai URL construction
    // Format: https://image.pollinations.ai/prompt/{encoded_prompt}
    // We can also add parameters like width, height, seed, etc.
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    // Adding a random seed to prevent caching and ensure variety
    const randomSeed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${randomSeed}&nologo=true`;

    // Since Pollinations returns the image directly via URL, we don't need to await a generation process.
    // We can just return the URL immediately.
    
    return NextResponse.json({ url: imageUrl });

  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}

