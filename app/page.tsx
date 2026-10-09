'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

type Mode = 'form' | 'prompt';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('form');
  const supabase = createClient();

  const [prompt, setPrompt] = useState(
    '5 days in Tokyo with 2 kids and my parents. We want to see Mt Fuji, eat at local ramen shops, and take it easy — my mother has knee problems.'
  );

  const [form, setForm] = useState({
    leavingFrom: 'Jakarta',
    destination: 'Tokyo',
    startDate: '2026-08-28',
    returnDate: '2026-09-01',
    adults: 2,
    kids: 2,
    elderly: 2,
    budget: 60000,
    transport: 'mix' as 'public' | 'rental' | 'mix',
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
    const start = new Date(form.startDate);
    const end = new Date(form.returnDate);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const payload =
        mode === 'form'
          ? { mode: 'form', form: { ...form, days: calcDays() } }
          : { mode: 'prompt', prompt };

      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
              <a href="#" className="hover:text-gray-900 text-gray-900 border-b-2 pb-1" style={{ borderColor: '#0d4d3d' }}>
                Holidays
              </a>
              <a href="#" className="hover:text-gray-900">Membership</a>
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
          <h1 className="text-4xl font-bold text-white mb-2">Holidays</h1>
          <p className="text-white/90 text-sm">
            Discover tailor-made experiences crafted by AI — stress-free family travel
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

            {/* Mode toggle */}
            <div className="px-6 pt-5">
              <div className="inline-flex bg-gray-100 rounded-full p-1">
                <button
                  onClick={() => setMode('form')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    mode === 'form' ? 'text-white shadow-sm' : 'text-gray-600'
                  }`}
                  style={mode === 'form' ? { backgroundColor: '#0d4d3d' } : {}}
                >
                  📋 Fill the form
                </button>
                <button
                  onClick={() => setMode('prompt')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    mode === 'prompt' ? 'text-white shadow-sm' : 'text-gray-600'
                  }`}
                  style={mode === 'prompt' ? { backgroundColor: '#0d4d3d' } : {}}
                >
                  💬 Describe it
                </button>
              </div>
            </div>

            {/* Form body */}
            <div className="p-6">
              {mode === 'form' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div className="border-b border-gray-200 pb-4">
                        <label className="block text-xs text-gray-500 mb-1">Leaving from</label>
                        <input
                          type="text"
                          value={form.leavingFrom}
                          onChange={(e) => update('leavingFrom', e.target.value)}
                          className="w-full text-lg font-semibold outline-none"
                        />
                      </div>

                      <div className="border-b border-gray-200 pb-4">
                        <label className="block text-xs text-gray-500 mb-1">Departing on</label>
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => update('startDate', e.target.value)}
                          className="w-full text-lg font-semibold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="border-b border-gray-200 pb-4">
                        <label className="block text-xs text-gray-500 mb-1">Going to</label>
                        <input
                          type="text"
                          value={form.destination}
                          onChange={(e) => update('destination', e.target.value)}
                          className="w-full text-lg font-semibold outline-none"
                        />
                      </div>

                      <div className="border-b border-gray-200 pb-4">
                        <label className="block text-xs text-gray-500 mb-1">Returning on</label>
                        <input
                          type="date"
                          value={form.returnDate}
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
                          min={0}
                          value={form.adults}
                          onChange={(e) => update('adults', parseInt(e.target.value) || 0)}
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
                </>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">
                    Describe your dream family trip
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="w-full border border-gray-200 rounded-lg p-4 text-sm outline-none focus:border-green-800 resize-none"
                    placeholder="e.g. 5 days in Tokyo with my wife, 2 young kids, and my parents. Budget around $8000. We want kid-friendly activities, a day of rest for us parents, and lots of food experiences."
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    AI will pick reasonable defaults for dates, budget, and transport.
                  </p>
                </div>
              )}

              {/* CTA */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="px-8 py-3 text-white font-semibold text-sm disabled:opacity-50 transition hover:opacity-90"
                  style={{ backgroundColor: '#0d4d3d' }}
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
              desc: 'From flights to dinner reservations — one prompt, complete itinerary.',
            },
            {
              icon: '👨‍👩‍👧‍👦',
              title: 'Built for families',
              desc: 'Parents get a day off. Kids get activities. Grandparents stay comfortable.',
            },
            {
              icon: '💬',
              title: '24/7 trip assistant',
              desc: 'Chat with your AI assistant on Telegram. Reminders before every activity.',
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