import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
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
    const adults = travelers.filter((t: any) => t.role === 'adult').length || 0;
    const kids = travelers.filter((t: any) => t.role === 'kid').length || 0;
    const seniors = travelers.filter((t: any) => t.role === 'elderly').length || 0;

    const adultNames = buildNames(adults, ['Dad', 'Mom'], 'Adult');
    const kidNames = buildNames(kids, ['Kid 1', 'Kid 2'], 'Kid');
    const seniorNames = buildNames(seniors, ['Grandpa', 'Grandma'], 'Senior');

    const travelerNames = [...adultNames, ...kidNames, ...seniorNames];
    const destination = plan.destination || 'the destination';
    const daysCount = days.length || plan.days || 1;

    const isSeniorOnly = adults === 0 && kids === 0 && seniors > 0;
    const seniorOnlyNote = isSeniorOnly
      ? `\nNOTE: This is a SENIORS-ONLY trip. Include medications, mobility aids (walking sticks, braces), reading glasses, and weather-appropriate layers. Exclude all kids items and general "Dad/Mom" items.\n`
      : '';

    const prompt = `You are a family trip packing assistant.

Trip: ${daysCount} days in ${destination}
${seniorOnlyNote}
Travelers (use EXACTLY these names as JSON keys, no others): ${travelerNames.join(', ')}

CRITICAL: The ONLY travelers are: ${travelerNames.join(', ')}. 
Do NOT invent names like "Dad", "Mom", or "Kid 1" unless they are in this list.
If a traveler is named "Grandpa", use "Grandpa" as the JSON key — not "Dad".
If a traveler is named "Grandma", use "Grandma" as the JSON key — not "Mom".

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
    "${travelerNames[0] || 'Dad'}": ["item1", "item2"],
    "${travelerNames[1] || 'Mom'}": ["item1", "item2"]
  }
}

Each traveler should have 4-6 items. Use the exact names from the list as the JSON keys.`;

    const data = await tryGenerate(prompt);

    // ─── STRICT VALIDATION: Discard any AI-invented names ───
    const validNames = new Set(travelerNames);
    const cleanedChecklists: Record<string, string[]> = {};

    Object.entries(data.checklists || {}).forEach(([name, items]: any) => {
      if (validNames.has(name)) {
        cleanedChecklists[name] = items;
      } else {
        // Discard invented names entirely (e.g. "Dad" on a seniors-only trip)
        console.log(`⚠️ AI returned unexpected traveler "${name}" — discarding.`);
      }
    });

    // Make sure all travelers have an entry (fallback if AI missed someone)
    travelerNames.forEach((name) => {
      if (!cleanedChecklists[name]) {
        const isSenior = /grandpa|grandma|senior/i.test(name);
        const isKid = /kid|child/i.test(name);
        
        if (isSenior) {
          cleanedChecklists[name] = [
            'Passport and ID documents',
            'Personal medications and health supplies',
            'Comfortable walking shoes',
            'Light layer for air conditioning',
            'Small crossbody bag for essentials',
          ];
        } else if (isKid) {
          cleanedChecklists[name] = [
            'Passport and ID',
            'Comfortable shoes',
            'Small entertainment (tablet/book)',
            'Snacks',
            'Light jacket',
          ];
        } else {
          cleanedChecklists[name] = [
            'Passport and travel documents',
            'Phone + charger',
            'Credit cards and local currency',
            'Comfortable walking shoes',
            'Light jacket',
          ];
        }
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