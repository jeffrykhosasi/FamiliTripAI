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

  const totalTravelers = form.adults + form.kids + form.elderly;
  const isSeniorOnly = form.adults === 0 && form.kids === 0 && form.elderly > 0;
  const hasKids = form.kids > 0;
  const hasSeniors = form.elderly > 0;

  const notesText = form.notes?.trim()
    ? `\nSPECIAL PREFERENCES: ${form.notes.trim()}`
    : '';

  const tripTypeGuidance = isSeniorOnly
    ? `
TRIP TYPE: SENIORS-ONLY TRIP
The travelers are all seniors (60+). This is NOT a family-with-kids trip.

CRITICAL REQUIREMENTS:
1. Morning starts: No activities before 9:30 AM.
2. Rest breaks: Include a 1-2 hour mid-afternoon break (return to hotel, tea stop, or seated activity) every day.
3. Limited walking: Max 2-3 hours walking per day. Prefer seated experiences.
4. Bathroom access: Mention restroom availability on long activities.
5. Step-free: Prefer flat, paved routes. Note elevator/ramp access.
6. NO theme parks: Skip Disneyland, Universal, high-intensity attractions.
7. Meals: Include seated restaurant lunch breaks. No street food walking tours.
8. Day length: End activities by 17:00 daily.
9. NO PARENTS' DAY OFF: Set parentsDayOff to null entirely.

Focus on:
- Cultural sites with comfortable access (temples, museums with seating)
- Scenic dining with views
- Gentle boat/river experiences
- Spa/onsen (with accessibility notes)
- Gardens and parks (flat paths)
- Shopping at comfortable malls (not street markets)
`
    : hasKids
    ? `
TRIP TYPE: FAMILY TRIP WITH KIDS
Standard family trip with kids. Include the "parents' day off" feature.
`
    : `
TRIP TYPE: ADULTS-ONLY TRIP
Standard adult-paced itinerary. Include "parents' day off" only if seniors traveling.
`;

  return `You are a family trip planner. Generate a detailed itinerary.

LEAVING FROM: ${form.leavingFrom}
DESTINATION: ${form.destination}
START DATE: ${form.startDate}
RETURN DATE: ${form.returnDate}
DURATION: ${form.days} days
TRAVELERS: ${form.adults} adults, ${form.kids} children (2-12), ${form.elderly} seniors (60+)
TOTAL BUDGET: HK$${form.budget} HKD
TRANSPORT: ${transportText}${notesText}

${tripTypeGuidance}

REQUIREMENTS:

A) BUDGET BREAKDOWN — realistic allocation across accommodation, food, transport, activities, and (if applicable) rental car, all in HK$ (Hong Kong Dollars).

B) FLIGHT:
   - Include a "flight" object with airline (Cathay Pacific preferred), flightNumber (e.g. "CX797"), route ("Jakarta (CGK) → Tokyo (NRT)"), departureTime, arrivalTime, duration (e.g. "7h 15m").
   - Include basePricePerAdult and basePricePerChild in HK$.
   - cabinOptions with economy (multiplier 1), premium (1.8), business (3.5).
   - Realistic flight times: usually morning departures for long-haul. Arrive at destination in afternoon.

C) RENTAL CAR DECISION:
   - If preference is "rental" or "mix": include rentalCar with type, dailyPrice, totalPrice, pickupLocation, dropoffLocation, days, note (all HK$).
   - If "public": set rentalCar.recommended = false.
   - Do NOT add pickup/return events to the itinerary — those are added automatically.

D) PER-ACTIVITY TRANSPORT — provide BOTH options for EVERY activity:
   {
     "recommended": "car" | "public",
     "car": { "available": true, "duration": "25 min", "distance": "12 km", "cost": 5, "details": "..." },
     "public": { "available": true, "duration": "35 min", "cost": 3, "details": "...", "line": "...", "frequency": "...", "walkTime": "..." }
   }
   - Rules for "recommended": if trip has rental car, ALWAYS "car" (unless unavailable). If no car, ALWAYS "public".
   - Add optional "alternativeHint" field ONLY if the non-recommended mode is significantly better (15+ min faster, saves HK$40+). Omit otherwise.

E) For each activity: cost_usd (in HK$), description, what's next, kidFriendly, elderlyFriendly.

F) PARENTS' DAY OFF:
   - If isSeniorOnly: set parentsDayOff to null.
   - If hasKids AND at least 2 adults: include parentsDayOff with parentsActivity + kidsActivity (with app suggestion and toy claim code).
   - Otherwise: set parentsDayOff to null.

G) LAST DAY — CRITICAL SEQUENCING:
   - The last day MUST include a "Travel to [departure airport]" activity.
   - This airport travel MUST be the LAST activity of the last day. NOTHING comes after it.
   - Any other last-day activities MUST be scheduled in the morning or early afternoon, BEFORE airport travel.
   - Airport travel should be scheduled 2.5 hours before flight departure.
   - For this specific airport activity, set transport.recommended to "public" and do NOT include a "car" option.
   - If the flight is in the morning, the last day should ONLY have the airport travel activity.

H) DAY NUMBERS: MUST be sequential integers starting from 1 (1, 2, 3, ... ${form.days}). NEVER use large numbers.

I) DAY 1 SEQUENCING: First activity of Day 1 must be scheduled AFTER the flight arrives (allow 2+ hours for immigration, baggage, transport). If arrival is 16:45, first activity is 18:30+.

J) TERMS & CONDITIONS: For every activity, generate a realistic 1-sentence refund policy based on standard industry practices (e.g., 'Free cancellation up to 24 hours', 'Non-refundable', '50% refund up to 48 hours').

Return ONLY valid JSON, no markdown:
{
  "destination": "string",
  "startDate": "${form.startDate}",
  "returnDate": "${form.returnDate}",
  "days": ${form.days},
  "travelers": [{ "name": "string", "role": "adult|kid|elderly" }],
  "flight": {
    "airline": "Cathay Pacific",
    "flightNumber": "CX797",
    "route": "string",
    "departureTime": "08:30",
    "arrivalTime": "16:45",
    "duration": "7h 15m",
    "basePricePerAdult": 1200,
    "basePricePerChild": 900,
    "cabinOptions": {
      "economy": { "multiplier": 1, "label": "Economy" },
      "premium": { "multiplier": 1.8, "label": "Premium" },
      "business": { "multiplier": 3.5, "label": "Business" }
    }
  },
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
      { "time": "09:00", "title": "string", "description": "string", "cost_usd": 0, "terms": "string (e.g., 'Free cancellation up to 48 hours prior. 50% refund within 24 hours.')", "transport": { "recommended": "car", "car": { "available": true, "duration": "25 min", "distance": "12 km", "cost": 5, "details": "string" }, "public": { "available": true, "duration": "35 min", "cost": 3, "details": "string", "line": "string", "frequency": "string", "walkTime": "string" } }, "next": "string", "kidFriendly": true, "elderlyFriendly": true }
    ] }
  ],
  "parentsDayOff": null
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
        const isBusy = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!isBusy) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastError;
}

function estimateDrive(publicDuration: string): { duration: string; distance: string } {
  const match = publicDuration?.match(/(\d+)/);
  const minutes = match ? parseInt(match[1]) : 30;
  const driveMinutes = Math.max(10, Math.round(minutes * 0.6));
  const distance = Math.max(2, Math.round(driveMinutes * 0.5));
  return { duration: `${driveMinutes} min`, distance: `${distance} km` };
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

    // 1. Sanitize day numbers
    if (plan.dailyPlans && plan.dailyPlans.length > 0) {
      plan.dailyPlans = plan.dailyPlans.map((day: any, idx: number) => ({
        ...day,
        day: idx + 1,
      }));
      plan.days = plan.dailyPlans.length;
    }

    // 2. Check eligibility for parents' day off
    const travelerRoles = (plan.travelers || []).map((t: any) => t.role);
    const kidCount = travelerRoles.filter((r: string) => r === 'kid').length;
    const adultCount = travelerRoles.filter((r: string) => r === 'adult').length;
    const eligibleForParentsDayOff = kidCount >= 1 && adultCount >= 2;

    if (!eligibleForParentsDayOff) {
      plan.parentsDayOff = null;
      console.log(`🚫 Skipping parents day off — kids: ${kidCount}, adults: ${adultCount}`);
    }

    // 3. Determine trip-wide transport mode
    const pref = payload.form?.transport || 'mix';
    const wantsCar = pref === 'rental' || pref === 'mix';

    if (wantsCar && !plan.rentalCar?.recommended) {
      plan.rentalCar = {
        recommended: true,
        type: plan.rentalCar?.type || '7-seat minivan',
        dailyPrice: plan.rentalCar?.dailyPrice || 85,
        totalPrice: (plan.rentalCar?.dailyPrice || 85) * (plan.days || 5),
        pickupLocation: plan.rentalCar?.pickupLocation || `${plan.destination || 'the destination'} Airport`,
        dropoffLocation: plan.rentalCar?.dropoffLocation || `${plan.destination || 'the destination'} Airport`,
        days: plan.days || 5,
        note: plan.rentalCar?.note || 'Comfortable for the whole family with luggage.',
      };
    }

    if (pref === 'public') {
      plan.rentalCar = { ...plan.rentalCar, recommended: false };
    }

    const hasCar = wantsCar && plan.rentalCar?.recommended;

    // 4. Fill in missing car info on every activity
    if (plan.dailyPlans) {
      plan.dailyPlans.forEach((day: any) => {
        (day.activities || []).forEach((a: any) => {
          if (!a.transport) a.transport = {};

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

          if (hasCar && a.transport.car?.available) {
            a.transport.recommended = 'car';
          } else if (!hasCar && a.transport.public?.available) {
            a.transport.recommended = 'public';
          }
        });
      });
    }

    // 5. Remove AI-generated rental car events
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

    // 6. Inject rental car pickup + return
    if (hasCar && plan.dailyPlans?.length > 0) {
      if (!plan.dailyPlans[0].activities) plan.dailyPlans[0].activities = [];
      plan.dailyPlans[0].activities.unshift({
        time: '10:00',
        title: '🚗 Pick up rental car',
        description: `Pick up your ${plan.rentalCar.type || 'rental car'} at ${plan.rentalCar.pickupLocation || 'the airport'}. Bring your driver's license and credit card.`,
        cost_usd: 0,
        transport: {
          recommended: 'public',
          public: { available: true, duration: '5 min walk', cost: 0, details: 'Walk to the rental counter inside the airport.' },
        },
        next: 'Then drive to your first activity.',
        kidFriendly: true,
        elderlyFriendly: true,
        isRentalCarEvent: true,
      });
      plan.dailyPlans[0].activities.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));

      let airportActivity: any = null;
      let airportDay: any = null;
      for (const day of plan.dailyPlans) {
        const found = (day.activities || []).find((a: any) => {
          if (a.isRentalCarEvent) return false;
          const t = (a.title || '').toLowerCase();
          return t.includes('airport') || t.includes('departure') || t.includes('flight') || t.includes('fly');
        });
        if (found) { airportActivity = found; airportDay = day; break; }
      }

      let returnTime = '14:00';
      if (airportActivity?.time) {
        const [h, m] = (airportActivity.time || '16:00').split(':').map(Number);
        const total = Math.max(0, h * 60 + (m || 0) - 90);
        returnTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      }

      const targetDay = airportDay || plan.dailyPlans[plan.dailyPlans.length - 1];
      if (!targetDay.activities) targetDay.activities = [];

      targetDay.activities.push({
        time: returnTime,
        title: '🚗 Return rental car',
        description: `Return the ${plan.rentalCar.type || 'rental car'} at ${plan.rentalCar.dropoffLocation || 'the drop-off location'}. Allow 30 min for inspection and fuel top-up.`,
        cost_usd: 0,
        transport: {
          recommended: 'car',
          car: { available: true, duration: '15 min', distance: '10 km', cost: 0, details: `Drive to ${plan.rentalCar.dropoffLocation || 'the return location'}.` },
        },
        next: 'Then walk or take the shuttle to your departure terminal.',
        kidFriendly: true,
        elderlyFriendly: true,
        isRentalCarEvent: true,
      });

      if (!airportActivity) {
        const [rh, rm] = returnTime.split(':').map(Number);
        const airportMin = rh * 60 + rm + 90;
        targetDay.activities.push({
          time: `${String(Math.floor(airportMin / 60)).padStart(2, '0')}:${String(airportMin % 60).padStart(2, '0')}`,
          title: '✈️ Travel to departure airport',
          description: `Head to the departure terminal. Arrive at least 2 hours before your flight.`,
          cost_usd: 8,
          transport: {
            recommended: 'public',
            public: { available: true, duration: '45 min', cost: 8, details: 'Take the airport express train or limousine bus to departures.' },
          },
          next: 'Check in, drop bags, and head to your gate.',
          kidFriendly: true,
          elderlyFriendly: true,
        });
      }

      targetDay.activities.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
    }

    // 7. Inject parents' day off (only if eligible)
    if (plan.parentsDayOff && eligibleForParentsDayOff) {
      const targetDay = plan.dailyPlans.find((d: any) => d.day === plan.parentsDayOff.day);
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
            car: { available: hasCar, duration: '20 min', distance: '10 km', cost: 5, details: 'Drive to the kids venue and park.' },
            public: { available: true, duration: '35 min', cost: 3, details: 'Take public transport to the kids venue.' },
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
            car: { available: hasCar, duration: '15 min', distance: '7 km', cost: 3, details: 'Drive to the venue and park.' },
            public: { available: true, duration: '25 min', cost: 2, details: 'Take public transport to the venue.' },
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
            car: { available: hasCar, duration: '15 min', distance: '7 km', cost: 3, details: 'Drive back to the kids venue.' },
            public: { available: true, duration: '25 min', cost: 2, details: 'Take public transport back.' },
          },
          next: 'Family reunited — dinner together.',
          kidFriendly: true,
          elderlyFriendly: false,
          isParentsDayOffEvent: true,
        });
        targetDay.theme = `Parents' Day Off — kids supervised, parents relax`;
      }
    }

    // 8. Ensure activities are chronologically sorted on each day
    if (plan.dailyPlans && plan.dailyPlans.length > 0) {
      for (const day of plan.dailyPlans) {
        if (day.activities) {
          day.activities.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
        }
      }
    }

    // 9. Save to DB
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
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}