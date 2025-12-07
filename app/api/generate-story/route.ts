import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const { hero, villain, location } = await req.json();

    if (!hero || !villain || !location) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const systemPrompt = `You are a creative comic book writer. You will generate a short, exciting 10-panel graphic novel script.
    
    First, analyze the user's input characters (${hero}, ${villain}). Determine the most likely source material or genre associated with them (e.g., Marvel Comics, DC Comics, Gundam Anime, Dragon Ball, Noir, etc.).
    
    Output Format: JSON object with the following structure:
    {
      "title": "Title of the Comic",
      "style_description": "A concise string describing the visual style inferred from the characters (e.g. '1990s Anime Style, cel-shaded' or 'Gritty Noir Comic, black and white')",
      "panels": [
        {
          "panel_number": 1,
          "image_prompt": "Detailed description of the scene for an image generator. Include the visual style instructions in every prompt.",
          "caption": "Narrative text for the caption box (optional, can be empty string)",
          "dialogue": "Character dialogue (optional, can be empty string)"
        }
      ]
    }

    The story should have a clear beginning, middle, and end.
    Characters: Hero: ${hero}, Villain: ${villain}.
    Setting: ${location}.
    Style: ADAPTIVE. Infer the style from the characters. If they are known characters, strictly adhere to their source material's vibe and visual language.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a 10-panel comic story for ${hero} vs ${villain} in ${location}.` }
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No content generated");
    }

    const story = JSON.parse(content);
    return NextResponse.json(story);

  } catch (error) {
    console.error('Error generating story:', error);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}

