import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data: trip } = await supabase.from('trips').select('*').eq('id', id).single();
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const plan = trip.plan;

    if (plan.rentalCar?.recommended) {
      return NextResponse.json({ plan, message: 'Already has a rental car' });
    }

    // ─── FORCE complete rentalCar object with safe fallbacks ───
    const destination = plan.destination || 'your destination';
    const days = plan.days || 5;
    const cityName = destination.split(',')[0].trim();

    const dailyPrice = plan.rentalCar?.dailyPrice || 85;
    const totalPrice = dailyPrice * days;

    // Force EXACT strings — no undefined
    plan.rentalCar = {
      recommended: true,
      type: (plan.rentalCar?.type && plan.rentalCar.type !== 'None') ? plan.rentalCar.type : '7-seat minivan',
      dailyPrice: dailyPrice,
      totalPrice: totalPrice,
      pickupLocation: (plan.rentalCar?.pickupLocation && plan.rentalCar.pickupLocation !== 'N/A') ? plan.rentalCar.pickupLocation : `${cityName} Airport`,
      dropoffLocation: (plan.rentalCar?.dropoffLocation && plan.rentalCar.dropoffLocation !== 'N/A') ? plan.rentalCar.dropoffLocation : `${cityName} Airport`,
      days: days,
      note: (plan.rentalCar?.note && plan.rentalCar.note !== 'N/A') ? plan.rentalCar.note : 'Comfortable for the whole family with luggage.',
    };

    console.log('🚗 Rental car object created:', plan.rentalCar);

    if (plan.budgetBreakdown) {
      plan.budgetBreakdown.rentalCar = totalPrice;
    }

    // Flip recommended → car for every activity
    plan.dailyPlans?.forEach((day: any) => {
      day.activities?.forEach((a: any) => {
        if (!a.transport) a.transport = {};
        if (!a.transport.car || !a.transport.car.available) {
          const publicDuration = a.transport.public?.duration || '30 min';
          const match = publicDuration.match(/(\d+)/);
          const minutes = match ? parseInt(match[1]) : 30;
          const driveMinutes = Math.max(10, Math.round(minutes * 0.6));
          
          a.transport.car = {
            available: true,
            duration: `${driveMinutes} min`,
            distance: `${Math.max(2, Math.round(driveMinutes * 0.5))} km`,
            cost: 5,
            details: `Drive to ${a.title}. Park nearby.`,
          };
        }
        a.transport.recommended = 'car';
      });
    });

    // CLEAN FIRST
    plan.dailyPlans?.forEach((day: any) => {
      day.activities = (day.activities || []).filter((a: any) => {
        if (a.isRentalCarEvent) return false;
        const t = (a.title || '').toLowerCase();
        if (t.includes('pick up rental')) return false;
        if (t.includes('return rental')) return false;
        if (t.includes('rental car')) return false;
        return true;
      });
    });

    // ─── Inject pickup ───
    if (plan.dailyPlans?.length > 0) {
      const day1 = plan.dailyPlans[0];
      if (!day1.activities) day1.activities = [];
      
      day1.activities.unshift({
        time: '10:00',
        title: '🚗 Pick up rental car',
        description: `Pick up your ${plan.rentalCar.type} at ${plan.rentalCar.pickupLocation}. Bring your driver's license and credit card.`,
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
      day1.activities.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
    }

    // ─── Find airport activity day OR use last day ───
    let returnDay = plan.dailyPlans[plan.dailyPlans.length - 1];
    let airportActivity: any = null;

    for (const day of plan.dailyPlans) {
      const found = (day.activities || []).find((a: any) => {
        if (a.isRentalCarEvent) return false;
        const t = (a.title || '').toLowerCase();
        return t.includes('airport') || t.includes('departure') || t.includes('flight');
      });
      if (found) {
        returnDay = day;
        airportActivity = found;
        break;
      }
    }

    console.log('🚗 Return day:', returnDay?.day, 'Airport activity:', airportActivity?.title);

    // ─── Return time: 90 min before airport or 14:00 ───
    let returnTime = '14:00';
    if (airportActivity?.time) {
      const [h, m] = (airportActivity.time || '16:00').split(':').map(Number);
      const total = Math.max(0, h * 60 + (m || 0) - 90);
      returnTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    if (!returnDay.activities) returnDay.activities = [];

    // ─── ALWAYS inject return card ───
    returnDay.activities.push({
      time: returnTime,
      title: '🚗 Return rental car',
      description: `Return the ${plan.rentalCar.type} at ${plan.rentalCar.dropoffLocation}. Allow 30 min for inspection and fuel top-up, then walk/shuttle to departures.`,
      cost_usd: 0,
      transport: {
        recommended: 'car',
        car: {
          available: true,
          duration: '15 min',
          distance: '10 km',
          cost: 0,
          details: `Drive to ${plan.rentalCar.dropoffLocation}, hand over the keys, and complete the return inspection.`,
        },
      },
      next: 'Then walk or take the shuttle to your departure terminal.',
      kidFriendly: true,
      elderlyFriendly: true,
      isRentalCarEvent: true,
    });

    // ─── Ensure airport travel exists ───
    const hasAirport = returnDay.activities.some((a: any) => {
      if (a.isRentalCarEvent) return false;
      const t = (a.title || '').toLowerCase();
      return t.includes('airport') || t.includes('departure') || t.includes('flight');
    });

    if (!hasAirport) {
      const [rh, rm] = returnTime.split(':').map(Number);
      const airportMin = rh * 60 + rm + 90;
      const airportTime = `${String(Math.floor(airportMin / 60)).padStart(2, '0')}:${String(airportMin % 60).padStart(2, '0')}`;

      returnDay.activities.push({
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
            details: 'Take the airport express train or limousine bus.',
          },
        },
        next: 'Check in, drop bags, and head to your gate.',
        kidFriendly: true,
        elderlyFriendly: true,
      });
    }


    returnDay.activities.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));

    plan.transportPlan = 'Rental car for the whole trip — park at hotels and use public transport in dense areas when faster.';

    await supabase.from('trips').update({ plan }).eq('id', id);

    return NextResponse.json({ plan });
  } catch (error: any) {
    console.error('Add car error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}