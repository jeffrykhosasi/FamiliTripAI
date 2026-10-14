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
    ? `\n\nSPECIAL PREFERENCES: ${form.notes.trim()}\nTailor the itinerary to these preferences (e.g. if "cultural", prioritize temples, museums, local traditions; if "foodie", add food tours and famous restaurants; if "relaxing", slower pace with downtime).`
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


IMPORTANT SEQUENCING:
1. First, decide the flight itinerary (departure time, arrival time, duration).
2. Then plan each day — especially Day 1 — anchored to the flight timing.
3. Day 1's first activity MUST be scheduled AFTER the flight arrives (allow 2+ hours for immigration, baggage, transport to hotel).

REQUIREMENTS:

A) BUDGET BREAKDOWN — realistic allocation across accommodation, food, transport, activities, and (if applicable) rental car.

B) RENTAL CAR DECISION:
   - If preference is "rental" or "mix": include a rental car recommendation with type, dailyPrice, totalPrice, pickupLocation, dropoffLocation, days, note.
   - If "public": no rental car (set rentalCar.recommended = false).
   - Do NOT add rental car pickup or return events to the itinerary — those will be added automatically by the system.

C) PER-ACTIVITY TRANSPORT — provide BOTH options for EVERY activity so families can compare:

   {
     "recommended": "car" | "public",
     "car": {
       "available": true,
       "duration": "25 min",
       "distance": "12 km",
       "cost": 5,
       "details": "Park at the venue's lot. Route 246 → Shibuya exit."
     },
     "public": {
       "available": true,
       "duration": "35 min",
       "cost": 3,
       "details": "Take JR Yamanote Line from Shibuya Station, 5 stops, 5-min walk from Exit A6.",
       "line": "JR Yamanote Line",
       "frequency": "Every 4 min",
       "walkTime": "5 min walk from Exit A6"
     }
   }

   Rules for "recommended":
   - MUST match the trip-wide mode: if the trip has a rental car, "recommended" is ALWAYS "car". If no rental car, ALWAYS "public".
   - This field means "what the family will most likely use", NOT "what's objectively fastest".

   ADD an optional "alternativeHint" field ONLY when the non-recommended mode is significantly better (15+ min faster, saves $5+):
   - Format: one short sentence. Omit if no clear advantage.

D) For each activity: cost_usd, description, what's next, kidFriendly, elderlyFriendly.

E) Include ONE "parents' day off" with a relaxing activity + separate kids' activity (app suggestion + toy claim code).

F) The LAST DAY must always include a "Travel to [departure airport]" activity at least 2 hours before departure. For this activity, set "transport.recommended" to "public" and DO NOT include a "car" option.

G) Respect constraints (e.g. knee problems → avoid hiking).

H) FLIGHTS: Generate realistic flight info for the route. Use real airline names (prefer Cathay Pacific when plausible). Estimate:
   - Realistic departure and arrival times based on typical schedules (usually morning departures for long-haul)
   - Realistic flight duration based on distance
   - basePricePerAdult: realistic economy round-trip price per adult in USD (Jakarta to Tokyo is ~$700-1200)
   - basePricePerChild: usually 75% of adult price
   

CRITICAL: The "day" field MUST be sequential integers starting from 1 (1, 2, 3, ... ${form.days}). Never use large numbers. Number of dailyPlans MUST equal ${form.days}.

Return ONLY valid JSON, no markdown:
{
  "destination": "string",
  "startDate": "${form.startDate}",
  "flight": {
    "airline": "Cathay Pacific",
    "flightNumber": "CX",
    "route": "${form.leavingFrom} → ${form.destination}",
    "departureTime": "08:30",
    "arrivalTime": "16:45",
    "duration": "7h 15m",
    "basePricePerAdult": 1200,
    "basePricePerChild": 900,
    "cabinOptions": {
      "economy": { "multiplier": 1, "label": "Economy" },
      "premium": { "multiplier": 1.8, "label": "Premium Economy" },
      "business": { "multiplier": 3.5, "label": "Business" }
    }
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

// Estimate drive time from public transit time (drive is usually ~60% of transit)
function estimateDrive(publicDuration: string): { duration: string; distance: string } {
  const match = publicDuration?.match(/(\d+)/);
  const minutes = match ? parseInt(match[1]) : 30;
  const driveMinutes = Math.max(10, Math.round(minutes * 0.6));
  const distance = Math.max(2, Math.round(driveMinutes * 0.5));
  return {
    duration: `${driveMinutes} min`,
    distance: `${distance} km`,
  };
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

    // ─── 1. Sanitize day numbers (fixes "Day 369" bug) ───
    if (plan.dailyPlans && plan.dailyPlans.length > 0) {
      plan.dailyPlans = plan.dailyPlans.map((day: any, idx: number) => ({
        ...day,
        day: idx + 1,
      }));
      plan.days = plan.dailyPlans.length;
    }

    // ─── Fix Day 1 sequencing based on flight arrival ───
    if (plan.flight?.arrivalTime && plan.dailyPlans?.[0]?.activities) {
      const arrivalMatch = plan.flight.arrivalTime.match(/(\d{1,2}):(\d{2})/);
      if (arrivalMatch) {
        const arrivalHours = parseInt(arrivalMatch[1]);
        const arrivalMinutes = parseInt(arrivalMatch[2]);
        const arrivalTotal = arrivalHours * 60 + arrivalMinutes;

        // Earliest an activity can start: 2 hours after arrival
        const earliestActivityTotal = arrivalTotal + 120;

        // Filter and adjust Day 1 activities
        const day1 = plan.dailyPlans[0];
        day1.activities = (day1.activities || [])
          .map((a: any) => {
            const timeMatch = (a.time || '').match(/(\d{1,2}):(\d{2})/);
            if (!timeMatch) return a;

            const activityTotal = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);

            // If activity is BEFORE arrival + buffer, push it later
            if (activityTotal < earliestActivityTotal) {
              const newTotal = earliestActivityTotal;
              const newHours = Math.floor(newTotal / 60);
              const newMinutes = newTotal % 60;
              return {
                ...a,
                time: `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`,
              };
            }
            return a;
          })
          // Remove "arrival"-type activities that come before the flight lands
          .filter((a: any) => {
            const timeMatch = (a.time || '').match(/(\d{1,2}):(\d{2})/);
            if (!timeMatch) return true;
            const activityTotal = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
            // Keep if it's after arrival or if it's an arrival-related activity
            const t = (a.title || '').toLowerCase();
            const isArrivalActivity = t.includes('arrive') || t.includes('flight') || t.includes('airport');
            return activityTotal >= earliestActivityTotal || isArrivalActivity;
          })
          // Sort by time
          .sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
      }
    }

    // ─── 2. Check eligibility for parents' day off ───
    const travelerRoles = (plan.travelers || []).map((t: any) => t.role);
    const kidCount = travelerRoles.filter((r: string) => r === 'kid').length;
    const adultCount = travelerRoles.filter((r: string) => r === 'adult').length;
    const eligibleForParentsDayOff = kidCount >= 1 && adultCount >= 2;

    if (!eligibleForParentsDayOff) {
      plan.parentsDayOff = null;
      console.log(
        `🚫 Skipping parents day off — kids: ${kidCount}, adults: ${adultCount}`
      );
    }

    // ─── 3. Determine trip-wide transport mode ───
    const pref = payload.form?.transport || 'mix';
    const wantsCar = pref === 'rental' || pref === 'mix';

    // Ensure rentalCar exists if the user wants one
    if (wantsCar && !plan.rentalCar?.recommended) {
      plan.rentalCar = {
        recommended: true,
        type: plan.rentalCar?.type || '7-seat minivan',
        dailyPrice: plan.rentalCar?.dailyPrice || 85,
        totalPrice: (plan.rentalCar?.dailyPrice || 85) * (plan.days || 5),
        pickupLocation:
          plan.rentalCar?.pickupLocation ||
          `${plan.destination || 'the destination'} Airport`,
        dropoffLocation:
          plan.rentalCar?.dropoffLocation ||
          `${plan.destination || 'the destination'} Airport`,
        days: plan.days || 5,
        note:
          plan.rentalCar?.note ||
          'Comfortable for the whole family with luggage.',
      };
    }

    // If user chose public transport, disable any car the AI added
    if (pref === 'public') {
      plan.rentalCar = { ...plan.rentalCar, recommended: false };
    }

    const hasCar = wantsCar && plan.rentalCar?.recommended;

    // ─── 4. Fill in missing car info on every activity ───
    if (plan.dailyPlans) {
      plan.dailyPlans.forEach((day: any) => {
        (day.activities || []).forEach((a: any) => {
          if (!a.transport) a.transport = {};

          // If trip has a car but activity doesn't, add a car option
          if (hasCar && !a.transport.car?.available) {
            const publicDuration = a.transport.public?.duration || '30 min';
            const est = estimateDrive(publicDuration);
            a.transport.car = {
              available: true,
              duration: est.duration,
              distance: est.distance,
              cost: 5,
              details: `Drive to ${a.title}. Park nearby.`,
            };
          }

          // Set recommended based on trip mode
          if (hasCar && a.transport.car?.available) {
            a.transport.recommended = 'car';
          } else if (!hasCar && a.transport.public?.available) {
            a.transport.recommended = 'public';
          }
        });
      });
    }

    // ─── 5. Remove any AI-generated rental car events ───
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

    // ─── 6. Inject rental car pickup + return + airport travel ───
    if (hasCar && plan.dailyPlans?.length > 0) {

      // Calculate pickup time: ~1 hour after flight arrival
      let pickupTime = '10:00';
      if (plan.flight?.arrivalTime) {
        const match = plan.flight.arrivalTime.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          const totalMinutes =
            parseInt(match[1]) * 60 + parseInt(match[2]) + 60; // +1 hour
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          pickupTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
      }

      // Pickup on Day 1
      if (!plan.dailyPlans[0].activities) plan.dailyPlans[0].activities = [];
      plan.dailyPlans[0].activities.unshift({
        time: pickupTime,
        title: '🚗 Pick up rental car',
        description: `After your flight arrives at ${plan.flight?.arrivalTime || 'the airport'}, pick up your ${plan.rentalCar.type || 'rental car'} at ${plan.rentalCar.pickupLocation || 'the airport'}. Bring your driver's license and credit card.`,
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

      // Return time: 90 min before airport, else 14:00
      let returnTime = '14:00';
      if (airportActivity?.time) {
        const [h, m] = (airportActivity.time || '16:00').split(':').map(Number);
        const total = Math.max(0, h * 60 + (m || 0) - 90);
        const rh = Math.floor(total / 60);
        const rm = total % 60;
        returnTime = `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
      }

      const targetDay = airportDay || plan.dailyPlans[plan.dailyPlans.length - 1];
      if (!targetDay.activities) targetDay.activities = [];

      // Return car — CAR ONLY
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

      // Force airport activity to be public-only, or inject if missing
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

    // ─── 7. Inject parents' day off (only if eligible) ───
    if (plan.parentsDayOff && eligibleForParentsDayOff) {
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

    // ─── 8. Save to DB ───
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