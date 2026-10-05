import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
];

async function tryGenerate(prompt: string) {
  let lastError: any = null;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Checklist: trying ${model} (attempt ${attempt})...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        const text = response.text ?? '';
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleaned);
        console.log(`✅ Checklist: success with ${model}`);
        return data;
      } catch (err: any) {
        lastError = err;
        const msg = err.message || '';
        const isBusy = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!isBusy) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  throw lastError;
}

export async function POST(req: Request) {
  try {
    const { plan } = await req.json();

    const prompt = `You are a family trip packing assistant.

Trip: ${plan.destination}
Travelers: ${plan.travelers.map((t: any) => `${t.name} (${t.role})`).join(', ')}

Here are the planned activities:
${plan.days.flatMap((d: any) => d.activities.map((a: any) => `- Day ${d.day}: ${a.title} — ${a.description}`)).join('\n')}

Generate a packing checklist for each traveler. Consider:
- Destination weather (if Tokyo in winter, add coats)
- Activities (if hiking, add shoes; if beach, add swimwear)
- Age-specific needs (kids need entertainment, grandparents need medications)
- Travel documents (passports, visas)

Return ONLY valid JSON, no markdown:
{
  "checklists": {
    "Dad": ["item1", "item2"],
    "Mom": ["item1", "item2"]
  }
}

Each traveler should have 4-7 items. Use their actual names from the trip if provided, otherwise use the roles.`;

    const data = await tryGenerate(prompt);
    return NextResponse.json({ checklists: data.checklists });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}