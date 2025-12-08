import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const { hero, villain, location } = await req.json();

    if (!hero || !villain || !location) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const systemPrompt = `You are a Legendary Comic Book Writer and Art Director. You are a master of visual storytelling, pacing, and dramatic tension.
    
    Your task is to write a 10-panel comic book script that is cinematic, emotionally resonant, and visually striking.
    
    INPUTS:
    - Hero: "${hero}"
    - Villain: "${villain}"
    - Location: "${location}"

    PHASE 1: CONCEPTUALIZATION
    Before writing the panels, silently generate a "Concept" based on these inputs:
    1.  **Rivalry/Linkage:** Why do they hate each other? (e.g., betrayal, lost family, ancient prophecy, former partners).
    2.  **Backstory Element:** A specific reference to their shared past to include in dialogue.
    3.  **Signature Moves:** Invent or identify a signature special move for both characters.
    4.  **Visual Style:** Determine the perfect art style (e.g., "Gritty Noir," "90s X-Men," "Jack Kirby Cosmic," "Cyberpunk Manga").

    PHASE 2: SCRIPT GENERATION (10 PANELS)
    Structure the story as follows:
    - **Panels 1-2 (The Setup):** Establish the location and the tension. Reveal the "Linkage" through dialogue.
    - **Panels 3-7 (The Escalation):** The fight begins. Trade blows. Use the "Signature Moves".
    - **Panel 8 (The Climax):** The decisive moment. High impact.
    - **Panels 9-10 (The Aftermath):** The dust settles. A cliffhanger or a moment of reflection.

    PHASE 3: ART DIRECTION
    For the "image_prompt" of EACH panel:
    - You MUST use cinematic camera terminology (e.g., "Low angle shot," "Dutch angle," "Extreme close-up on eyes," "Wide panoramic shot").
    - You MUST append the specific Visual Style keywords to EVERY prompt to ensure consistency.
    - Example: "Low angle shot of Batman landing on a gargoyle, heavy rain, lightning background. Gotham City gothic style, dark shadows, bold ink lines, Frank Miller aesthetic."

    OUTPUT FORMAT (Strict JSON):
    {
      "title": "A Punchy, Comic-Booky Title",
      "style_description": "The chosen visual style description",
      "panels": [
        {
          "panel_number": 1,
          "image_prompt": "cinematic camera description + action description + visual style keywords",
          "caption": "Narrative box text (optional)",
          "dialogue": "Character Name: Dialogue text"
        }
        ... (up to panel 10)
      ]
    }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the 10-panel script for ${hero} vs ${villain} at ${location}. Make it legendary.` }
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

