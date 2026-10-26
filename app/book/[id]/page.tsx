'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function BookPage() {
  const params = useParams();
  const id = params.id as string;
  const [status, setStatus] = useState<'loading' | 'booking' | 'done' | 'error'>('loading');
  const [bookings, setBookings] = useState<any[]>([]);
  const [trip, setTrip] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function run() {
      setStatus('loading');
      try {
        // 1. Fetch trip data (for flight info)
        const tripRes = await fetch(`/api/plan/${id}`);
        const tripData = await tripRes.json();
        if (!tripData.error) setTrip(tripData);

        // 2. Fetch bookings
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

  if (status === 'loading' || status === 'booking') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div
            className="animate-spin w-16 h-16 border-4 border-gray-200 rounded-full mx-auto mb-6"
            style={{ borderTopColor: '#0d4d3d' }}
          />
          <h1 className="text-2xl font-bold mb-2">Booking everything...</h1>
          <p className="text-gray-500">We're confirming your activities and reservations.</p>
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
          <a href="/trips" className="inline-block border border-gray-300 px-4 py-2 rounded-lg text-sm">
            ← My trips
          </a>
        </div>
      </main>
    );
  }

  // Calculate total miles earned (HK$15 = 1 mile)
  const totalMilesEarned = Math.floor(
    bookings.reduce((sum, b) => sum + (b.details?.cost_usd || 0), 0) / 15
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100">
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
          
          {/* The Miles Badge */}
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full" style={{ backgroundColor: '#fef3c7' }}>
            <span className="text-sm font-semibold text-amber-800">
              ✨ You've earned {totalMilesEarned.toLocaleString('en-US')} miles
            </span>
          </div>

          <p className="text-sm text-gray-400 mt-3">
            Your trip assistant is ready to keep you on track.
          </p>
        </div>

        {/* Flight Details Card */}
        {trip?.plan?.flight && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="font-semibold mb-4">Your Flight</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: '#0d4d3d' }}>
                  ✈️
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0d4d3d' }}>
                    {trip.plan.flight.airline || 'Cathay Pacific'}
                  </p>
                  <p className="font-bold text-lg">
                    {trip.plan.flight.flightNumber || 'CX'} · {trip.plan.flight.route}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{trip.plan.flight.departureTime} → {trip.plan.flight.arrivalTime}</p>
                <p className="text-xs text-gray-500">{trip.plan.flight.duration}</p>
              </div>
            </div>
          </div>
        )}

        {/* Telegram Connect with QR Code */}
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#0d4d3d' }}>1</div>
                  <div>
                    <p className="font-semibold text-sm">Scan the QR code</p>
                    <p className="text-xs text-gray-500">Opens Telegram on your phone</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#0d4d3d' }}>2</div>
                  <div>
                    <p className="font-semibold text-sm">Tap START</p>
                    <p className="text-xs text-gray-500">Links your trip automatically</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#0d4d3d' }}>3</div>
                  <div>
                    <p className="font-semibold text-sm">Chat anytime</p>
                    <p className="text-xs text-gray-500">Ask questions, send photos</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2 text-center">Already on this device?</p>
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
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Booking confirmations</h2>
          {bookings.length === 0 && <p className="text-sm text-gray-500">No bookings found.</p>}
          {bookings.map((b, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
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
        </div>
      </div>
    </main>
  );
}