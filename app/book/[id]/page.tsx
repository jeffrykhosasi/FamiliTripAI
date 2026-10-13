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
      setStatus('loading');
      try {
        // Fetch trip + bookings in parallel
        const [tripRes, bookingsRes] = await Promise.all([
          fetch(`/api/plan/${id}`),
          fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tripId: id }),
          }),
        ]);

        const trip = await tripRes.json();
        const bookingsData = await bookingsRes.json();

        if (trip.error) {
          setError(trip.error);
          setStatus('error');
          return;
        }

        // If already booked — use the parallel-fetched bookings immediately
        if (trip.status === 'booked') {
          if (bookingsData.error) {
            setError(bookingsData.error);
            setStatus('error');
          } else {
            setBookings(bookingsData.bookings || []);
            setStatus('done');
          }
          return;
        }

        // Not booked yet — now actually create bookings
        setStatus('booking');
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
          setBookings(data.bookings || []);
          setStatus('done');
        }
      } catch (e: any) {
        setError(e.message || 'Something went wrong');
        setStatus('error');
      }
    }
    run();
  }, [id]);

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div
            className="animate-spin w-16 h-16 border-4 border-gray-200 rounded-full mx-auto mb-6"
            style={{ borderTopColor: '#0d4d3d' }}
          />
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
          <p className="text-gray-500">Just a moment.</p>
        </div>
      </main>
    );
  }

  if (status === 'booking') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div
            className="animate-spin w-16 h-16 border-4 border-gray-200 rounded-full mx-auto mb-6"
            style={{ borderTopColor: '#0d4d3d' }}
          />
          <h1 className="text-2xl font-bold mb-2">Booking everything...</h1>
          <p className="text-gray-500">
            We're confirming your activities and reservations.
          </p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <p className="text-4xl mb-4">😔</p>
          <h1 className="text-xl font-bold mb-2">Booking failed</h1>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <a
            href="/trips"
            className="inline-block border border-gray-300 px-4 py-2 rounded-lg text-sm"
          >
            ← My trips
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold" style={{ color: '#0d4d3d' }}>
            FamilyTrip
          </a>
          <a
            href="/trips"
            className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          >
            🗂 My trips
          </a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center mb-6">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-3xl font-bold mb-2">All booked!</h1>
          <p className="text-gray-600 mb-1">
            {bookings.length} activities confirmed for your trip.
          </p>
          <p className="text-sm text-gray-400">
            Your trip assistant is ready to keep you on track.
          </p>
        </div>

        {/* Telegram connect with QR */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-4xl mb-3">📱</p>
            <h2 className="font-bold text-lg mb-1">Meet your trip assistant</h2>
            <p className="text-sm text-gray-600">
              Get reminders, ask questions, and send photos — all through Telegram.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    `https://t.me/familytrip_ai_bot?start=${id}`
                  )}`}
                  alt="QR code"
                  width={180}
                  height={180}
                />
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                📷 Scan with your phone camera
              </p>
            </div>

            <div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: '#0d4d3d' }}
                  >
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Scan the QR code</p>
                    <p className="text-xs text-gray-500">Opens Telegram on your phone</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: '#0d4d3d' }}
                  >
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Tap START</p>
                    <p className="text-xs text-gray-500">Links your trip automatically</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: '#0d4d3d' }}
                  >
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Chat anytime</p>
                    <p className="text-xs text-gray-500">Ask questions, send photos</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2 text-center">
                  Already on this device?
                </p>
                <a
                  href={`https://t.me/familytrip_ai_bot?start=${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-white px-6 py-2.5 rounded-lg font-semibold text-sm"
                  style={{ backgroundColor: '#0088cc' }}
                >
                  💬 Open in Telegram
                </a>
              </div>

              <div className="mt-4 bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">
                  💡 What can you ask?
                </p>
                <p className="text-xs text-blue-900">
                  "What's my plan for today?" · "I'm tired, any lighter options?" ·
                  "Best ramen nearby?"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Booking confirmations */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Booking confirmations</h2>
          {bookings.length === 0 && (
            <p className="text-sm text-gray-500">No bookings found.</p>
          )}
          {bookings.map((b, i) => (
            <div
              key={i}
              className="flex justify-between items-center py-2 border-b last:border-0"
            >
              <div>
                <p className="font-medium text-sm">
                  Day {b.details?.day} · {b.details?.time} — {b.details?.title}
                </p>
                {b.details?.cost_usd ? (
                  <p className="text-xs text-gray-500">${b.details.cost_usd}</p>
                ) : null}
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-mono">
                {b.confirmation_id}
              </span>
            </div>
          ))}
        </div>

        {/* Next steps */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-semibold mb-4">Next steps</h2>

          {/* Primary: View itinerary */}
          <a
            href={`/itinerary/${id}`}
            className="block w-full text-center text-white py-4 rounded-lg font-semibold mb-4 text-base"
            style={{ backgroundColor: '#0d4d3d' }}
          >
            📖 View full itinerary
          </a>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`/checklist/${id}`}
              className="flex-1 border-2 py-3 rounded-lg font-semibold text-center"
              style={{ borderColor: '#0d4d3d', color: '#0d4d3d' }}
            >
              📋 Family checklist
            </a>
            <a
              href={`/photos/${id}`}
              className="flex-1 border-2 py-3 rounded-lg font-semibold text-center"
              style={{ borderColor: '#0d4d3d', color: '#0d4d3d' }}
            >
              📸 Photos
            </a>
            <a
              href={`/recap/${id}`}
              className="flex-1 border-2 py-3 rounded-lg font-semibold text-center"
              style={{ borderColor: '#0d4d3d', color: '#0d4d3d' }}
            >
              🎬 Recap
            </a>
          </div>
          <div className="text-center mt-4">
            <a
              href="/trips"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              ← All my trips
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}