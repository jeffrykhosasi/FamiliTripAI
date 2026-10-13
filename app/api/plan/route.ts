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
  const promptBody =
    payload.mode === 'prompt'
      ? `The user described their dream trip in free text:

"${payload.prompt}"

INFER all details: destination, dates, duration, travelers, budget, transport preference. If missing, assume: start date 3 months from today, budget $5000/adult + $3000/child/senior, transport "mix".`
      : `LEAVING FROM: ${payload.form.leavingFrom}
DESTINATION: ${payload.form.destination}
START DATE: ${payload.form.startDate}
RETURN DATE: ${payload.form.returnDate}
DURATION: ${payload.form.days} days
TRAVELERS: ${payload.form.adults} adults, ${payload.form.kids} children (2-12), ${payload.form.elderly} seniors (60+)
TOTAL BUDGET: $${payload.form.budget} USD
TRANSPORT PREFERENCE: ${payload.form.transport}`;

  return `You are a family trip planner. ${promptBody}

REQUIREMENTS:

A) BUDGET BREAKDOWN — realistic allocation across accommodation, food, transport, activities, and (if applicable) rental car.

B) RENTAL CAR DECISION:
   - If preference is "rental" or "mix": include a rental car recommendation with type, dailyPrice, totalPrice, pickupLocation, dropoffLocation, days, note.
   - If "public": no rental car (set rentalCar.recommended = false).
   - Do NOT add rental car pickup or return events to the itinerary — those will be added automatically by the system.

C) PER-ACTIVITY TRANSPORT — provide BOTH options for EVERY activity so families can compare:

   Every activity must have a "transport" object shaped like:
   {
     "recommended": "car" | "public",
     "car": {
       "available": true,
       "duration": "25 min",
       "distance": "12 km",
       "cost": 5,
       "details": "Park at the venue's lot (¥500/hr). Route 246 → Shibuya exit."
     },
     "public": {
       "available": true,
       "duration": "35 min",
       "cost": 3,
       "details": "Take JR Yamanote Line from Shibuya Station (Platform 3) toward Shinjuku. 5 stops, ~15 min. 5-min walk from Exit A6.",
       "line": "JR Yamanote Line",
       "frequency": "Every 4 min",
       "walkTime": "5 min walk from Exit A6"
     }
   }

   Rules for "recommended":
   - This MUST match the trip-wide mode: if the trip has a rental car, "recommended" is ALWAYS "car" (except when car.available = false). If no rental car, "recommended" is ALWAYS "public".

   ADDITIONALLY, add an optional "alternativeHint" field:
   - Include it ONLY when the non-recommended mode is significantly better (15+ min faster, or saves $5+ per person).
   - Format: one short sentence.
   - Omit if no clear advantage.

D) For each activity: cost_usd, description, what's next, kidFriendly, elderlyFriendly.

E) Include ONE "parents' day off" with a relaxing activity + separate kids' activity (app suggestion + toy claim code).

F) The LAST DAY must always include a "Travel to [departure airport]" activity at least 2 hours before departure. For this activity, set "transport.recommended" to "public" and DO NOT include a "car" option.

G) Respect constraints (e.g. knee problems → avoid hiking).

Return ONLY valid JSON, no markdown:
{
  "destination": "string",
  "startDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "days": number,
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
    {
      "day": 1,
      "date": "string",
      "theme": "string",
      "activities": [
        {
          "time": "09:00",
          "title": "string",
          "description": "string",
          "cost_usd": 0,
          "transport": {
            "recommended": "car",
            "alternativeHint": "optional string",
            "car": { "available": true, "duration": "25 min", "distance": "12 km", "cost": 5, "details": "string" },
            "public": { "available": true, "duration": "35 min", "cost": 3, "details": "string", "line": "string", "frequency": "string", "walkTime": "string" }
          },
          "next": "string",
          "kidFriendly": true,
          "elderlyFriendly": true
        }
      ]
    }
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

    // ─── Sanitize day numbers — AI sometimes outputs huge numbers like 369 ───
    if (plan.dailyPlans && plan.dailyPlans.length > 0) {
      plan.dailyPlans = plan.dailyPlans.map((day: any, idx: number) => ({
        ...day,
        day: idx + 1,
      }));
      plan.days = plan.dailyPlans.length;
    }

    // Force recommended to match trip-wide mode
    const tripMode = payload.mode === 'form' ? payload.form?.transport : 'mix';
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

    // Remove AI-generated rental car events
    if (plan.dailyPlans) {
      plan.dailyPlans.forEach((day: any) => {
        day.activities = (day.activities || []).filter((a: any) => {
          if (a.isRentalCarEvent) return false;
          const title = (a.title || '').toLowerCase();
          if (title.includes('pick up rental')) return false;
          if (title.includes('return rental')) return false;
          if (title.includes('rental car')) return false;
          return true;
        });
      });
    }

    // Rental car: pickup, return, airport
    const pref = payload.mode === 'form' ? payload.form?.transport : 'mix';
    const hasCar =
      (pref === 'rental' || pref === 'mix') && plan.rentalCar?.recommended;

    if (hasCar && plan.dailyPlans?.length > 0) {
      // Pickup on Day 1
      if (!plan.dailyPlans[0].activities) plan.dailyPlans[0].activities = [];
      plan.dailyPlans[0].activities.unshift({
        time: '10:00',
        title: '🚗 Pick up rental car',
        description: `Pick up your ${plan.rentalCar.type || 'rental car'} at ${plan.rentalCar.pickupLocation || 'the airport'}. Bring your driver's license and credit card.`,
        cost_usd: 0,
        transport: {
          recommended: 'public',
          public: {
            available: true,
            duration: '5 min walk',
            cost: 0,
            details: 'Walk to the rental counter inside the airport.',
          },
        },
        next: 'Then drive to your first activity.',
        kidFriendly: true,
        elderlyFriendly: true,
        isRentalCarEvent: true,
      });
      plan.dailyPlans[0].activities.sort((a: any, b: any) =>
        (a.time || '').localeCompare(b.time || '')
      );

      // Find airport activity across all days
      let airportActivity: any = null;
      let airportDay: any = null;
      for (const day of plan.dailyPlans) {
        const found = (day.activities || []).find((a: any) => {
          if (a.isRentalCarEvent) return false;
          const t = (a.title || '').toLowerCase();
          return (
            t.includes('airport') ||
            t.includes('departure') ||
            t.includes('flight') ||
            t.includes('fly')
          );
        });
        if (found) {
          airportActivity = found;
          airportDay = day;
          break;
        }
      }

      // Return time
      let returnTime = '14:00';
      if (airportActivity?.time) {
        const [h, m] = (airportActivity.time || '16:00').split(':').map(Number);
        const total = Math.max(0, h * 60 + (m || 0) - 90);
        const rh = Math.floor(total / 60);
        const rm = total % 60;
        returnTime = `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
      }

      const targetDay =
        airportDay || plan.dailyPlans[plan.dailyPlans.length - 1];
      if (!targetDay.activities) targetDay.activities = [];

      // Return car activity (car-only)
      targetDay.activities.push({
        time: returnTime,
        title: '🚗 Return rental car',
        description: `Return the ${plan.rentalCar.type || 'rental car'} at ${plan.rentalCar.dropoffLocation || 'the drop-off location'}. Allow 30 min for inspection and fuel top-up.`,
        cost_usd: 0,
        transport: {
          recommended: 'car',
          car: {
            available: true,
            duration: '15 min',
            distance: '10 km',
            cost: 0,
            details: `Drive to ${plan.rentalCar.dropoffLocation || 'the return location'}, hand over the keys, and complete the return inspection.`,
          },
        },
        next: 'Then walk or take the shuttle to your departure terminal.',
        kidFriendly: true,
        elderlyFriendly: true,
        isRentalCarEvent: true,
      });

      // Force airport activity to be public-only
      if (airportActivity) {
        airportActivity.transport = {
          recommended: 'public',
          public: {
            available: true,
            duration: airportActivity.transport?.public?.duration || '45 min',
            cost: airportActivity.transport?.public?.cost || 8,
            details:
              airportActivity.transport?.public?.details ||
              'Take the airport express train or limousine bus to departures.',
            line: airportActivity.transport?.public?.line,
            frequency: airportActivity.transport?.public?.frequency,
            walkTime: airportActivity.transport?.public?.walkTime,
          },
        };
      } else {
        const [rh, rm] = returnTime.split(':').map(Number);
        const airportMin = rh * 60 + rm + 90;
        const ah = Math.floor(airportMin / 60);
        const am = airportMin % 60;
        const airportTime = `${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`;

        targetDay.activities.push({
          time: airportTime,
          title: '✈️ Travel to departure airport',
          description: `Head to the departure terminal. Arrive at least 2 hours before your flight.`,
          cost_usd: 8,
          transport: {
            recommended: 'public',
            public: {
              available: true,
              duration: '45 min',
              cost: 8,
              details: 'Take the airport express train or limousine bus to departures.',
            },
          },
          next: 'Check in, drop bags, and head to your gate.',
          kidFriendly: true,
          elderlyFriendly: true,
        });
      }

      targetDay.activities.sort((a: any, b: any) =>
        (a.time || '').localeCompare(b.time || '')
      );
    }

    // Parents' day off
    if (plan.parentsDayOff && plan.dailyPlans) {
      const targetDay = plan.dailyPlans.find(
        (d: any) => d.day === plan.parentsDayOff.day
      );
      if (targetDay) {
        const kidsA = plan.parentsDayOff.kidsActivity || {};
        const parentsA = plan.parentsDayOff.parentsActivity || {};
        const kidsTitle = kidsA.title || 'Supervised kids activity';
        const kidsDesc = kidsA.description || 'Kids are supervised by staff.';
        const kidsApp = kidsA.appSuggestion || 'YouTube Kids';
        const kidsCode = kidsA.toyClaimCode || 'TOY-KIDS';
        const parentsTitle = parentsA.title || 'Parents relax';
        const parentsDesc = parentsA.description || 'Enjoy some time to yourselves.';
        const parentsCost = parentsA.cost_usd || 0;

        targetDay.activities = [];

        targetDay.activities.push({
          time: '09:00',
          title: `👶 Kids dropped off: ${kidsTitle}`,
          description: `${kidsDesc}\n\nSupervised — parents free until 16:00.\n\n📱 App: ${kidsApp}\n🎁 Toy code: ${kidsCode}`,
          cost_usd: 0,
          transport: {
            recommended: hasCar ? 'car' : 'public',
            car: {
              available: hasCar,
              duration: '20 min',
              distance: '10 km',
              cost: 5,
              details: 'Drive to the kids venue and park.',
            },
            public: {
              available: true,
              duration: '35 min',
              cost: 3,
              details: 'Take public transport to the kids venue.',
            },
          },
          next: 'Drop the kids here, then head to your own activity.',
          kidFriendly: true,
          elderlyFriendly: false,
          isParentsDayOffEvent: true,
        });

        targetDay.activities.push({
          time: '09:30',
          title: `💆 Parents' time: ${parentsTitle}`,
          description: `${parentsDesc}\n\nKids are supervised until 16:00.`,
          cost_usd: parentsCost,
          transport: {
            recommended: hasCar ? 'car' : 'public',
            car: {
              available: hasCar,
              duration: '15 min',
              distance: '7 km',
              cost: 3,
              details: 'Drive to the venue and park.',
            },
            public: {
              available: true,
              duration: '25 min',
              cost: 2,
              details: 'Take public transport to the venue.',
            },
          },
          next: 'Kids pick-up at 16:00.',
          kidFriendly: false,
          elderlyFriendly: false,
          isParentsDayOffEvent: true,
        });

        targetDay.activities.push({
          time: '16:00',
          title: '👶 Pick up kids',
          description: 'Head back to collect your children.',
          cost_usd: 0,
          transport: {
            recommended: hasCar ? 'car' : 'public',
            car: {
              available: hasCar,
              duration: '15 min',
              distance: '7 km',
              cost: 3,
              details: 'Drive back to the kids venue.',
            },
            public: {
              available: true,
              duration: '25 min',
              cost: 2,
              details: 'Take public transport back.',
            },
          },
          next: 'Family reunited — dinner together.',
          kidFriendly: true,
          elderlyFriendly: false,
          isParentsDayOffEvent: true,
        });

        targetDay.theme = `Parents' Day Off — kids supervised, parents relax`;
      }
    }

    // Save
    const form =
      payload.mode === 'form'
        ? payload.form
        : {
            destination: plan.destination,
            startDate: plan.startDate,
            days: plan.days,
            adults: plan.travelers?.filter((t: any) => t.role === 'adult').length || 1,
            kids: plan.travelers?.filter((t: any) => t.role === 'kid').length || 0,
            elderly: plan.travelers?.filter((t: any) => t.role === 'elderly').length || 0,
            budget: plan.budgetBreakdown?.total || 0,
            transport: 'mix',
            leavingFrom: '',
          };

    const { data, error } = await supabase
      .from('trips')
      .insert({
        prompt: JSON.stringify(payload),
        plan,
        status: 'draft',
        user_id: user.id,
        destination: plan.destination || 'Trip',
        start_date: plan.startDate || null,
        days: plan.days || 1,
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