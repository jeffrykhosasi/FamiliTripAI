'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import AirportInput from '@/components/AirportInput';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const [form, setForm] = useState({
    leavingFrom: '',
    destination: '',
    startDate: '',
    returnDate: '',
    adults: 1,
    kids: 0,
    elderly: 0,
    budget: 5000,
    transport: 'mix' as 'public' | 'rental' | 'mix',
    notes: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  function update(field: string, value: any) {
    setForm({ ...form, [field]: value });
  }

  function calcDays() {
    if (!form.startDate || !form.returnDate) return 1;
    const start = new Date(form.startDate);
    const end = new Date(form.returnDate);
    return Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  const canSubmit =
    /\([A-Z]{3}\)$/.test(form.leavingFrom.trim()) &&
    /\([A-Z]{3}\)$/.test(form.destination.trim()) &&
    form.leavingFrom !== form.destination &&
    form.startDate &&
    form.returnDate &&
    form.returnDate > form.startDate;

  async function handleGenerate() {
    // Validate cities
    const leavingValid = /\([A-Z]{3}\)$/.test(form.leavingFrom.trim());
    const destinationValid = /\([A-Z]{3}\)$/.test(form.destination.trim());

    if (!leavingValid) {
      setError('Please pick a departure airport from the dropdown.');
      return;
    }
    if (!destinationValid) {
      setError('Please pick a destination airport from the dropdown.');
      return;
    }
    if (form.leavingFrom === form.destination) {
      setError('Departure and destination cannot be the same airport.');
      return;
    }

    // Validate dates
    if (!form.startDate) {
      setError('Please pick a departure date.');
      return;
    }
    if (!form.returnDate) {
      setError('Please pick a return date.');
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (form.startDate < todayStr) {
      setError('Departure date cannot be in the past.');
      return;
    }
    if (form.returnDate <= form.startDate) {
      setError('Return date must be after departure date.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'form',
          form: { ...form, days: calcDays() },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      window.location.href = `/plan/${data.id}`;
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <span className="text-2xl font-bold tracking-tight" style={{ color: '#0d4d3d' }}>
              FamilyTrip
            </span>
            <div className="hidden md:flex gap-7 text-sm font-medium text-gray-700">
              <a href="/" className="text-gray-900 border-b-2 pb-1" style={{ borderColor: '#0d4d3d' }}>
                Plan new trip
              </a>
              <a href="/trips" className="hover:text-gray-900">
                My trips
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
                <button
                  onClick={signOut}
                  className="border border-gray-300 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
                >
                  Sign out
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-white text-xs font-bold">
                  {user.email?.[0]?.toUpperCase()}
                </div>
              </>
            ) : (
              <a
                href="/login"
                className="border border-gray-300 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                Sign in / up
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div
        className="relative"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.5)), url(https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-6">
          <h1 className="text-4xl font-bold text-white mb-2">Plan your family holiday</h1>
          <p className="text-white/90 text-sm">
            AI-crafted itineraries tailored for every generation — kids, parents, and grandparents
          </p>
        </div>

        {/* Overlapping form card */}
        <div className="max-w-7xl mx-auto px-6 pb-0 translate-y-16 relative z-10">
          <div className="bg-white shadow-xl rounded-t-lg">
            {/* Single tab */}
            <div className="flex">
              <div
                className="flex-1 py-4 px-6 text-left"
                style={{ backgroundColor: '#0d4d3d', color: 'white' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">✦ AI Planner</span>
                  <span className="text-lg">−</span>
                </div>
              </div>
            </div>

            {/* Form body */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div
                    className={`border-b pb-4 ${
                      form.leavingFrom && !/\([A-Z]{3}\)$/.test(form.leavingFrom)
                        ? 'border-red-400'
                        : 'border-gray-200'
                    }`}
                  >
                    <label className="block text-xs text-gray-500 mb-1">Leaving from</label>
                    <AirportInput
                      value={form.leavingFrom}
                      onChange={(v) => update('leavingFrom', v)}
                      placeholder="e.g. Jakarta"
                      error={!!form.leavingFrom && !/\([A-Z]{3}\)$/.test(form.leavingFrom)}
                    />
                    {form.leavingFrom && !/\([A-Z]{3}\)$/.test(form.leavingFrom) && (
                      <p className="text-xs text-red-500 mt-1">
                        Pick an airport from the dropdown
                      </p>
                    )}
                  </div>

                  <div className="border-b border-gray-200 pb-4">
                    <label className="block text-xs text-gray-500 mb-1">Departing on</label>
                    <input
                      type="date"
                      value={form.startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        update('startDate', newStart);
                        if (form.returnDate && form.returnDate <= newStart) {
                          const next = new Date(newStart);
                          next.setDate(next.getDate() + 1);
                          update('returnDate', next.toISOString().split('T')[0]);
                        }
                      }}
                      className="w-full text-lg font-semibold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-5">
                  <div
                    className={`border-b pb-4 ${
                      form.destination && !/\([A-Z]{3}\)$/.test(form.destination)
                        ? 'border-red-400'
                        : 'border-gray-200'
                    }`}
                  >
                    <label className="block text-xs text-gray-500 mb-1">Going to</label>
                    <AirportInput
                      value={form.destination}
                      onChange={(v) => update('destination', v)}
                      placeholder="e.g. Tokyo"
                      disabledCode={
                        form.leavingFrom.match(/\(([A-Z]{3})\)/)?.[1] || undefined
                      }
                      error={!!form.destination && !/\([A-Z]{3}\)$/.test(form.destination)}
                    />
                    {form.destination && !/\([A-Z]{3}\)$/.test(form.destination) && (
                      <p className="text-xs text-red-500 mt-1">
                        Pick an airport from the dropdown
                      </p>
                    )}
                  </div>

                  <div className="border-b border-gray-200 pb-4">
                    <label className="block text-xs text-gray-500 mb-1">Returning on</label>
                    <input
                      type="date"
                      value={form.returnDate}
                      min={(() => {
                        if (!form.startDate) return new Date().toISOString().split('T')[0];
                        const d = new Date(form.startDate);
                        d.setDate(d.getDate() + 1);
                        return d.toISOString().split('T')[0];
                      })()}
                      onChange={(e) => update('returnDate', e.target.value)}
                      className="w-full text-lg font-semibold outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Travelers */}
              <div className="mt-6 border-t border-gray-200 pt-5">
                <label className="block text-xs text-gray-500 mb-2">Travelers</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Adults</label>
                    <input
                      type="number"
                      min={1}
                      value={form.adults}
                      onChange={(e) => update('adults', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full text-lg font-semibold outline-none border-b border-gray-200 pb-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Seniors (60+)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.elderly}
                      onChange={(e) => update('elderly', parseInt(e.target.value) || 0)}
                      className="w-full text-lg font-semibold outline-none border-b border-gray-200 pb-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Children (2-12)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.kids}
                      onChange={(e) => update('kids', parseInt(e.target.value) || 0)}
                      className="w-full text-lg font-semibold outline-none border-b border-gray-200 pb-1"
                    />
                  </div>
                </div>
              </div>

              {/* Transport + Budget */}
              <div className="mt-6 border-t border-gray-200 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Getting around</label>
                  <div className="flex gap-2">
                    {[
                      { v: 'public', l: '🚇 Transit' },
                      { v: 'rental', l: '🚗 Rental' },
                      { v: 'mix', l: '🔀 Mix' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => update('transport', o.v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          form.transport === o.v
                            ? 'text-white border-transparent'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                        style={form.transport === o.v ? { backgroundColor: '#0d4d3d' } : {}}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Trip Budget Guardrail
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold whitespace-nowrap">
                      ${form.budget.toLocaleString('en-US')}
                    </span>
                    <input
                      type="range"
                      min={1000}
                      max={100000}
                      step={1000}
                      value={form.budget}
                      onChange={(e) => update('budget', parseInt(e.target.value))}
                      className="flex-1"
                      style={{ accentColor: '#0d4d3d' }}
                    />
                  </div>
                </div>
              </div>

              {/* Notes field */}
              <div className="mt-6 border-t border-gray-200 pt-5">
                <label className="block text-xs text-gray-500 mb-1">
                  Anything special? <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="e.g. cultural trip, foodie focus, relaxing pace, kid-friendly..."
                  className="w-full text-sm outline-none border-b border-gray-200 pb-2 focus:border-green-700"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Hint: try "cultural", "adventure", "foodie", "relaxing", or "kid-focused"
                </p>
              </div>

              {/* CTA */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !canSubmit}
                  className="px-8 py-3 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90"
                  style={{ backgroundColor: canSubmit ? '#0d4d3d' : '#9ca3af' }}
                >
                  {loading ? 'Planning your trip...' : 'Build your dream holiday'}
                </button>
              </div>

              {error && (
                <p className="mt-4 text-red-600 text-sm text-right">{error}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-20 bg-gradient-to-b from-transparent to-white" />

      {/* Features preview */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Why families love us</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '🤖',
              title: 'AI plans everything',
              desc: 'Flights, hotels, restaurants, activities — one form, complete itinerary.',
            },
            {
              icon: '👨‍👩‍👧‍👦',
              title: 'Built for families',
              desc: 'Parents get a day off. Kids get activities. Grandparents stay comfortable.',
            },
            {
              icon: '💬',
              title: '24/7 trip assistant',
              desc: 'Chat with your AI concierge on Telegram. Ask anything, anytime.',
            },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}