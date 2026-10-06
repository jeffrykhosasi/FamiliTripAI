import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
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
        const isBusy =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429');
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

    if (!plan) {
      return NextResponse.json({ error: 'No plan provided' }, { status: 400 });
    }

    // Support both old (days) and new (dailyPlans) schema
    const days = plan.dailyPlans || plan.days || [];

    const activitiesList = days
      .flatMap((d: any) =>
        (d.activities || []).map(
          (a: any) => `- Day ${d.day || '?'}: ${a.title || 'Activity'} — ${a.description || ''}`
        )
      )
      .join('\n');

    const travelers = (plan.travelers || [])
      .map((t: any) => `${t.name || 'Traveler'} (${t.role || 'adult'})`)
      .join(', ');

    const destination = plan.destination || 'the destination';
    const daysCount = days.length || plan.days || 1;

    const prompt = `You are a family trip packing assistant.

Trip: ${daysCount} days in ${destination}
Travelers: ${travelers || 'Family'}

Planned activities:
${activitiesList || '(no specific activities)'}

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

Use the actual traveler names from the trip if provided, otherwise use roles like "Dad", "Mom", "Child", "Grandparent". Each traveler should have 4-7 items.`;

    const data = await tryGenerate(prompt);

    return NextResponse.json({ checklists: data.checklists || {} });
  } catch (error: any) {
    console.error('Checklist generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}