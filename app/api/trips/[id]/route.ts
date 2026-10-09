import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/get-user';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    }

    const { id } = await params;

    // Verify the trip belongs to this user (prevents deleting other users' trips)
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('id, status, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Prevent deleting booked trips (safety)
    if (trip.status === 'booked') {
      return NextResponse.json(
        { error: 'Cannot delete a booked trip' },
        { status: 400 }
      );
    }

    // Delete photos from storage first (if any)
    const { data: photos } = await supabase
      .from('photos')
      .select('url')
      .eq('trip_id', id);

    if (photos && photos.length > 0) {
      const paths = photos
        .map((p: any) => p.url.split('/trip-photos/')[1])
        .filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('trip-photos').remove(paths);
      }
    }

    // Delete the trip — cascades to photos, checklists, bookings, telegram_links
    const { error } = await supabase.from('trips').delete().eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}