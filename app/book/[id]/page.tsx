'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function BookPage() {
  const params = useParams();
  const id = params.id as string;
  const [status, setStatus] = useState<'loading' | 'booking' | 'done' | 'error'>('loading');
  const [bookings, setBookings] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function run() {
      setStatus('booking');
      try {
        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: id }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setStatus('error');
        } else {
          setBookings(data.bookings);
          setStatus('done');
        }
      } catch (e: any) {
        setError(e.message);
        setStatus('error');
      }
    }
    run();
  }, [id]);

  if (status === 'loading' || status === 'booking') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div className="animate-spin w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">Booking everything...</h1>
          <p className="text-gray-500">
            We're contacting restaurants, booking tickets, and reserving your activities.
          </p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <p className="text-4xl mb-4">😔</p>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center mb-6">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-3xl font-bold mb-2">All booked!</h1>
          <p className="text-gray-600 mb-1">
            {bookings.length} activities confirmed for your trip.
          </p>
          <p className="text-sm text-gray-400">
            Your WhatsApp assistant is ready to keep you on track.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Booking confirmations</h2>
          {bookings.map((b, i) => (
            <div
              key={i}
              className="flex justify-between items-center py-2 border-b last:border-0"
            >
              <div>
                <p className="font-medium text-sm">
                  Day {b.details.day} · {b.details.time} — {b.details.title}
                </p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-mono">
                {b.confirmation_id}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-semibold mb-4">Next steps</h2>
          <div className="flex gap-3">
            <a
              href={`/checklist/${id}`}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold text-center"
            >
              📋 Family checklist
            </a>
            <a
              href={`/recap/${id}`}
              className="flex-1 border border-indigo-600 text-indigo-600 py-3 rounded-lg font-semibold text-center"
            >
              🎬 Trip recap
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}