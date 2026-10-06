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

    plan.rentalCar = {
      recommended: true,
      type: plan.rentalCar?.type || '7-seat minivan',
      dailyPrice: plan.rentalCar?.dailyPrice || 85,
      totalPrice: (plan.rentalCar?.dailyPrice || 85) * (plan.days || 5),
      pickupLocation: plan.rentalCar?.pickupLocation || 'Airport Terminal 1',
      dropoffLocation: plan.rentalCar?.dropoffLocation || 'Airport Terminal 1',
      days: plan.days || 5,
      note: 'Comfortable for the whole family with luggage.',
    };

    if (plan.budgetBreakdown) {
      plan.budgetBreakdown.rentalCar = plan.rentalCar.totalPrice;
    }

    // Flip recommended → car and ensure car option exists for every activity
    plan.dailyPlans?.forEach((day: any) => {
      day.activities?.forEach((a: any) => {
        if (!a.transport) a.transport = {};
        if (!a.transport.car || !a.transport.car.available) {
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
        a.transport.recommended = 'car';
      });
    });

    // CLEAN FIRST: remove ALL rental car events (AI or previous injection)
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

    // Re-inject pickup + return + airport travel
    if (plan.dailyPlans?.length > 0) {
      plan.dailyPlans[0].activities.unshift({
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
      plan.dailyPlans[0].activities.sort((a: any, b: any) =>
        (a.time || '').localeCompare(b.time || '')
      );

      // Find day with airport activity
      let returnDay = plan.dailyPlans[plan.dailyPlans.length - 1];
      let airportActivity: any = null;

      for (const day of plan.dailyPlans) {
        const found = day.activities.find((a: any) => {
          const t = (a.title || '').toLowerCase();
          return (
            t.includes('airport') ||
            t.includes('departure') ||
            t.includes('flight') ||
            t.includes('fly')
          );
        });
        if (found) {
          returnDay = day;
          airportActivity = found;
          break;
        }
      }

      let returnTime = '14:00';
      if (airportActivity) {
        const [h, m] = (airportActivity.time || '16:00').split(':').map(Number);
        const total = Math.max(0, h * 60 + m - 90);
        const rh = Math.floor(total / 60);
        const rm = total % 60;
        returnTime = `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
      }

      // Return car activity — NO car option
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

      const hasAirport = returnDay.activities.some((a: any) => {
        if (a.isRentalCarEvent) return false;
        const t = (a.title || '').toLowerCase();
        return (
          t.includes('airport') ||
          t.includes('departure') ||
          t.includes('flight') ||
          t.includes('fly')
        );
      });

      if (!hasAirport) {
        const [rh, rm] = returnTime.split(':').map(Number);
        const airportMin = rh * 60 + rm + 90;
        const ah = Math.floor(airportMin / 60);
        const am = airportMin % 60;
        const airportTime = `${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`;

        returnDay.activities.push({
          time: airportTime,
          title: '✈️ Travel to departure airport',
          description: `Head to the departure terminal. Arrive at least 2 hours before your flight. Take the airport express train or limousine bus.`,
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

      returnDay.activities.sort((a: any, b: any) =>
        (a.time || '').localeCompare(b.time || '')
      );
    }

    plan.transportPlan =
      'Rental car for the whole trip — park at hotels and use public transport in dense areas when faster.';

    await supabase.from('trips').update({ plan }).eq('id', id);

    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function estimateDrive(publicDuration: string) {
  const match = publicDuration.match(/(\d+)/);
  const minutes = match ? parseInt(match[1]) : 30;
  const driveMinutes = Math.max(10, Math.round(minutes * 0.6));
  const distance = Math.round(driveMinutes * 0.5);
  return {
    duration: `${driveMinutes} min`,
    distance: `${distance} km`,
  };
}