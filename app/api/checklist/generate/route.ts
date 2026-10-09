import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = [
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

// Deterministic naming for travelers
function buildNames(
  count: number,
  pair: [string, string],
  fallbackPrefix: string
): string[] {
  const names: string[] = [];
  if (count >= 1) names.push(pair[0]);
  if (count >= 2) names.push(pair[1]);
  for (let i = 3; i <= count; i++) {
    names.push(`${fallbackPrefix} ${i}`);
  }
  return names;
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
          (a: any) =>
            `- Day ${d.day || '?'}: ${a.title || 'Activity'} — ${a.description || ''}`
        )
      )
      .join('\n');

    // Deterministic naming based on traveler counts
    const travelers = plan.travelers || [];
    const adults = travelers.filter((t: any) => t.role === 'adult').length || 1;
    const kids = travelers.filter((t: any) => t.role === 'kid').length || 0;
    const seniors = travelers.filter((t: any) => t.role === 'elderly').length || 0;

    const adultNames = buildNames(adults, ['Dad', 'Mom'], 'Adult');
    const kidNames = buildNames(kids, ['Kid 1', 'Kid 2'], 'Kid');
    const seniorNames = buildNames(seniors, ['Grandpa', 'Grandma'], 'Senior');

    const travelerNames = [...adultNames, ...kidNames, ...seniorNames];
    const destination = plan.destination || 'the destination';
    const daysCount = days.length || plan.days || 1;

    const prompt = `You are a family trip packing assistant.

Trip: ${daysCount} days in ${destination}
Travelers (use EXACTLY these names as JSON keys, no others): ${travelerNames.join(', ')}

Planned activities:
${activitiesList || '(no specific activities)'}

Generate a packing checklist for EACH traveler listed above. Use the EXACT names given — do not invent new names.

Consider:
- Destination weather (if cold, add coats)
- Activities (if hiking, add shoes)
- Age-specific needs (kids need entertainment, seniors need medications)
- Travel documents (passports, visas)

Return ONLY valid JSON, no markdown:
{
  "checklists": {
    "${adultNames[0] || 'Dad'}": ["item1", "item2"],
    "${adultNames[1] || 'Mom'}": ["item1", "item2"],
    "${kidNames[0] || 'Kid 1'}": ["item1", "item2"],
    "${seniorNames[0] || 'Grandpa'}": ["item1", "item2"]
  }
}

Each traveler should have 4-6 items. Use the exact names from the list as the JSON keys.`;

    const data = await tryGenerate(prompt);

    // Validate the response uses our names, not AI-invented ones
    const validNames = new Set(travelerNames);
    const cleanedChecklists: Record<string, string[]> = {};

    Object.entries(data.checklists || {}).forEach(([name, items]: any) => {
      // If AI returned a name we didn't ask for, merge it into the closest match
      if (validNames.has(name)) {
        cleanedChecklists[name] = items;
      } else {
        // Find the first unused valid name
        const unused = travelerNames.find((n) => !cleanedChecklists[n]);
        if (unused) {
          cleanedChecklists[unused] = items;
        }
      }
    });

    // Make sure all travelers have an entry
    travelerNames.forEach((name) => {
      if (!cleanedChecklists[name]) {
        cleanedChecklists[name] = ['Passport', 'Phone + charger', 'Travel documents'];
      }
    });

    return NextResponse.json({ checklists: cleanedChecklists });
  } catch (error: any) {
    console.error('Checklist generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}