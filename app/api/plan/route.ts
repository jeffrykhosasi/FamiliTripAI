import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/get-user';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

function buildPrompt(payload: any): string {
  const form = payload.form;

  const transportMap: Record<string, string> = {
    public: 'public transportation only (trains, buses, subways)',
    rental: 'rental car for the whole trip',
    mix: 'a mix of public transportation and rental car where it makes sense',
  };
  const transportText = transportMap[form.transport] || transportMap.mix;

  const notesText = form.notes?.trim()
    ? `\nSPECIAL PREFERENCES: ${form.notes.trim()}\nTailor the itinerary to these preferences. For example, if they say "cultural", prioritize temples, museums, and local traditions. If "foodie", add food tours and famous restaurants.`
    : '';

  return `You are a family trip planner. Generate a detailed itinerary.

LEAVING FROM: ${form.leavingFrom}
DESTINATION: ${form.destination}
START DATE: ${form.startDate}
RETURN DATE: ${form.returnDate}
DURATION: ${form.days} days
TRAVELERS: ${form.adults} adults, ${form.kids} children (2-12), ${form.elderly} seniors (60+)
TOTAL BUDGET: $${form.budget} USD
TRANSPORT: ${transportText}${notesText}

REQUIREMENTS:
1. Break the budget down realistically: accommodation, food, transport, activities.
2. For each activity: cost (USD), how to get there (transport + duration), what to do, and what comes next.
3. Mark each activity with kidFriendly and elderlyFriendly booleans.
4. Include ONE "parents' day off" with a kids' activity (app suggestion + toy claim code).
5. Total budget must be <= $${form.budget} USD.
6. The LAST DAY must always include a "Travel to [departure airport]" activity at least 2 hours before departure.

CRITICAL: The "day" field MUST be sequential integers starting from 1 (1, 2, 3, ... ${form.days}). Never use large numbers. The number of dailyPlans entries MUST equal ${form.days}.

Return ONLY valid JSON, no markdown, in exactly this shape:
{
  "destination": "string",
  "startDate": "${form.startDate}",
  "returnDate": "${form.returnDate}",
  "days": ${form.days},
  "travelers": [{ "name": "string", "role": "adult|kid|elderly" }],
  "budgetBreakdown": { "accommodation": 0, "food": 0, "transport": 0, "activities": 0, "rentalCar": 0, "total": 0 },
  "transportPlan": "string",
  "rentalCar": {
    "recommended": true,
    "type": "7-seat minivan",
    "dailyPrice": 85,
    "totalPrice": 255,
    "pickupLocation": "string",
    "dropoffLocation": "string",
    "days": 3,
    "note": "string"
  },
  "dailyPlans": [
    { "day": 1, "date": "string", "theme": "string", "activities": [
      { "time": "09:00", "title": "string", "description": "string", "cost_usd": 0, "transport": { "recommended": "car", "car": { "available": true, "duration": "25 min", "distance": "12 km", "cost": 5, "details": "string" }, "public": { "available": true, "duration": "35 min", "cost": 3, "details": "string", "line": "string", "frequency": "string", "walkTime": "string" } }, "next": "string", "kidFriendly": true, "elderlyFriendly": true }
    ] }
  ],
  "parentsDayOff": {
    "day": 2,
    "parentsActivity": { "title": "string", "description": "string", "cost_usd": 0 },
    "kidsActivity": { "title": "string", "description": "string", "appSuggestion": "string", "toyClaimCode": "string" }
  }
}`;
}

async function tryGenerate(prompt: string): Promise<any> {
  let lastError: any = null;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Plan: trying ${model} (attempt ${attempt})...`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        const text = response.text ?? '';
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log(`✅ Plan: success with ${model}`);
        return JSON.parse(cleaned);
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    }

    const payload = await req.json();
    const prompt = buildPrompt(payload);
    const plan = await tryGenerate(prompt);

    // Sanitize day numbers
    if (plan.dailyPlans && plan.dailyPlans.length > 0) {
      plan.dailyPlans = plan.dailyPlans.map((day: any, idx: number) => ({
        ...day,
        day: idx + 1,
      }));
      plan.days = plan.dailyPlans.length;
    }

    // Force recommended to match trip-wide mode
    const tripMode = payload.form?.transport || 'mix';
    const usesCar = tripMode === 'rental' || tripMode === 'mix';
    if (plan.dailyPlans) {
      plan.dailyPlans.forEach((day: any) => {
        (day.activities || []).forEach((a: any) => {
          if (a.transport) {
            if (usesCar && a.transport.car?.available) {
              a.transport.recommended = 'car';
            } else if (!usesCar && a.transport.public?.available) {
              a.transport.recommended = 'public';
            }
          }
        });
      });
    }

    // (keep the rest of your existing injection logic — rental car events, parents' day off)

    // Save to DB
    const form = payload.form;
    const { data, error } = await supabase
      .from('trips')
      .insert({
        prompt: JSON.stringify(payload),
        plan,
        status: 'draft',
        user_id: user.id,
        destination: plan.destination || form.destination,
        start_date: plan.startDate || form.startDate,
        days: plan.days || form.days,
        travelers_count: (form.adults || 0) + (form.kids || 0) + (form.elderly || 0),
        budget_usd: form.budget || 0,
        transport_preference: form.transport || 'mix',
        parents_day_off: plan.parentsDayOff || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ id: data.id, plan });
  } catch (error: any) {
    console.error('Plan API error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}