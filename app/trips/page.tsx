'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/login');
        return;
      }
      setUser(userData.user);

      const res = await fetch('/api/trips');
      const data = await res.json();
      if (data.error) setError(data.error);
      else setTrips(Array.isArray(data) ? data : []);
      setLoading(false);
    }
    load();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

    async function handleDelete(tripId: string) {
        if (!confirm('Delete this draft? This cannot be undone.')) return;

        const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.error) {
        alert('Could not delete: ' + data.error);
        return;
        }

        setTrips((prev) => prev.filter((t) => t.id !== tripId));
    }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading your trips...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <a href="/" className="text-xl font-bold" style={{ color: '#0d4d3d' }}>
              FamilyTrip
            </a>
            <div className="hidden md:flex gap-7 text-sm font-medium text-gray-700">
              <a href="/" className="hover:text-gray-900">
                Plan new trip
              </a>
              <a
                href="/trips"
                className="text-gray-900 border-b-2 pb-1"
                style={{ borderColor: '#0d4d3d' }}
              >
                My trips
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              className="border border-gray-300 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">My Trips</h1>
            <p className="text-gray-500 text-sm">
              {trips.length} trip{trips.length === 1 ? '' : 's'}
            </p>
          </div>
          <a
            href="/"
            className="text-white px-6 py-3 rounded-lg font-semibold"
            style={{ backgroundColor: '#0d4d3d' }}
          >
            + New trip
          </a>
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 p-4 rounded-lg mb-6">{error}</p>
        )}

        {trips.length === 0 && (
          <div
            className="bg-white rounded-2xl shadow-sm p-16 text-center relative overflow-hidden"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(13, 77, 61, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212, 165, 116, 0.05) 0%, transparent 50%)',
            }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 text-4xl"
              style={{ backgroundColor: '#e8f0ed' }}
            >
              ✈️
            </div>
            <h2 className="text-2xl font-bold mb-3">
              Your first adventure awaits
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
              Tell us where you want to go and who's coming along. We'll craft a
              stress-free itinerary in minutes — complete with activities for every
              generation.
            </p>
            <a
              href="/"
              className="inline-block text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              ✨ Plan your first trip
            </a>
            <p className="text-xs text-gray-400 mt-6">
              Average planning time: 20 seconds
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {trips.map((trip) => {
            const isBooked = trip.status === 'booked';
            const startDate = trip.start_date
              ? new Date(trip.start_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Dates TBD';

            return (
              <div
                key={trip.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-xl font-bold mb-1">
                        {trip.destination || 'Untitled trip'}
                      </h2>
                      <p className="text-sm text-gray-500">{startDate}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        isBooked
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {isBooked ? '✓ Booked' : 'Draft'}
                    </span>
                  </div>

                  <div className="flex gap-4 text-sm text-gray-600 mb-5">
                    <span>📅 {trip.days || 1} days</span>
                    <span>👥 {trip.travelers_count || 1} travelers</span>
                    <span>💰 ${(trip.budget_usd || 0).toLocaleString('en-US')}</span>
                  </div>

                  {isBooked ? (
                    <div className="flex gap-2">
                      <a
                        href={`/book/${trip.id}`}
                        className="flex-1 text-center text-white py-2.5 rounded-lg font-semibold text-sm"
                        style={{ backgroundColor: '#0d4d3d' }}
                      >
                        View booking
                      </a>
                      <a
                        href={`/checklist/${trip.id}`}
                        className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                        title="Checklist"
                      >
                        📋
                      </a>
                      <a
                        href={`/recap/${trip.id}`}
                        className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                        title="Recap"
                      >
                        🎬
                      </a>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <a
                        href={`/plan/${trip.id}`}
                        className="flex-1 text-center border-2 py-2.5 rounded-lg font-semibold text-sm"
                        style={{ borderColor: '#0d4d3d', color: '#0d4d3d' }}
                      >
                        Continue planning →
                      </a>
                      <button
                        onClick={() => handleDelete(trip.id)}
                        className="px-4 py-2.5 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50"
                        title="Delete draft"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}