import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data: trip } = await supabase.from('trips').select('*').eq('id', id).single();
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const plan = trip.plan;

    if (!plan.rentalCar || !plan.rentalCar.recommended) {
      return NextResponse.json({ plan, message: 'No rental car to remove' });
    }

    plan.rentalCar = { ...plan.rentalCar, recommended: false };

    if (plan.budgetBreakdown) {
      plan.budgetBreakdown.rentalCar = 0;
    }

    // Flip recommended → public for every activity
    plan.dailyPlans?.forEach((day: any) => {
      day.activities?.forEach((a: any) => {
        if (a.transport) {
          a.transport.recommended = 'public';
        }
      });
    });

    // Remove ALL rental car events
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

    plan.transportPlan =
      'Public transportation only — trains, buses, and subways. No rental car.';

    await supabase.from('trips').update({ plan }).eq('id', id);

    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}