'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ItineraryPage() {
  const params = useParams();
  const id = params.id as string;
  const [trip, setTrip] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'today' | 'all'>('all');
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/plan/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setTrip(data);
          setPlan(data.plan);

          // Auto-select "today" view if today is within the trip
          const start = new Date(data.plan?.startDate || '');
          const today = new Date();
          const dayNum = Math.floor(
            (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;
          if (dayNum >= 1 && dayNum <= (data.plan?.days || 0)) {
            setView('today');
          }
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading your itinerary...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <p className="text-4xl mb-4">😔</p>
          <p className="font-bold mb-2">Could not load itinerary</p>
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

  if (!plan) return null;

  const days = plan.dailyPlans || plan.days || [];
  const travelers = plan.travelers || [];

  // Compute today's day number
  const start = new Date(plan.startDate || '');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const todayDayNum =
    Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const isTripActive = todayDayNum >= 1 && todayDayNum <= (plan.days || 0);

  const daysToShow =
    view === 'today' && isTripActive
      ? days.filter((d: any) => d.day === todayDayNum)
      : days;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold" style={{ color: '#0d4d3d' }}>
            FamilyTrip
          </a>
          <div className="flex gap-2 text-sm">
            <a
              href="/trips"
              className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              🗂 My trips
            </a>
            <a
              href={`/book/${id}`}
              className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              🎫 Bookings
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">{plan.destination}</h1>
          <p className="text-gray-500 text-sm mb-4">
            {plan.startDate} → {plan.returnDate} · {plan.days} days ·{' '}
            {travelers.length} travelers
          </p>

          {/* Today / All toggle */}
          <div className="flex gap-2 items-center">
            <div className="inline-flex bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setView('today')}
                disabled={!isTripActive}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  view === 'today' && isTripActive
                    ? 'text-white shadow-sm'
                    : 'text-gray-600'
                }`}
                style={
                  view === 'today' && isTripActive
                    ? { backgroundColor: '#0d4d3d' }
                    : {}
                }
              >
                📍 Today
              </button>
              <button
                onClick={() => setView('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  view === 'all' ? 'text-white shadow-sm' : 'text-gray-600'
                }`}
                style={view === 'all' ? { backgroundColor: '#0d4d3d' } : {}}
              >
                📅 All days
              </button>
            </div>

            {!isTripActive && (
              <span className="text-xs text-gray-400">
                (Today view unlocks when your trip starts)
              </span>
            )}
            {isTripActive && (
              <span className="text-xs text-green-700 font-medium">
                ✈️ You're on Day {todayDayNum}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Days */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {daysToShow.length === 0 && (
          <p className="text-gray-500 text-center py-12">
            No activities for this view.
          </p>
        )}

        {daysToShow.map((day: any) => (
          <div key={day.day} className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-white text-sm font-bold rounded-lg px-3 py-1.5"
                style={{ backgroundColor: '#0d4d3d' }}
              >
                Day {day.day}
              </span>
              <span className="text-gray-500 text-sm">{day.date}</span>
              {day.theme && (
                <span className="text-sm font-medium text-gray-700">
                  — {day.theme}
                </span>
              )}
              {isTripActive && day.day === todayDayNum && (
                <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full ml-auto">
                  TODAY
                </span>
              )}
            </div>

            {day.activities?.map((a: any, ai: number) => {
              const key = `${day.day}-${ai}`;
              const isExpanded = expandedActivity === key;
              const t = a.transport || {};

              return (
                <div
                  key={ai}
                  className={`rounded-xl mb-3 overflow-hidden ${
                    a.isRentalCarEvent
                      ? 'border-2 border-green-700 bg-green-50'
                      : a.isParentsDayOffEvent
                      ? 'border-2 border-yellow-500 bg-yellow-50'
                      : 'border border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => setExpandedActivity(isExpanded ? null : key)}
                    className="w-full text-left p-4 hover:bg-gray-50/50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-mono text-gray-500 pt-0.5 w-14">
                        {a.time}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {a.isRentalCarEvent && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-800 bg-green-200 px-1.5 py-0.5 rounded">
                              🚗 Rental Car
                            </span>
                          )}
                          {a.isParentsDayOffEvent && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-800 bg-yellow-200 px-1.5 py-0.5 rounded">
                              ✨ Parents' Day Off
                            </span>
                          )}
                          <p className="font-semibold text-gray-900">{a.title}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-1">
                          {a.kidFriendly && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              👶 Kid
                            </span>
                          )}
                          {a.elderlyFriendly && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              👴 Senior
                            </span>
                          )}
                        </div>
                        {a.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {a.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-sm font-semibold">${a.cost_usd || 0}</p>
                        <p className="text-gray-400 text-xs">
                          {isExpanded ? '▲' : '▼'}
                        </p>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                      {a.description && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            What to do
                          </p>
                          <p className="text-sm text-gray-700">{a.description}</p>
                        </div>
                      )}

                      {(t.car?.available || t.public?.available) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            How to get there
                          </p>
                          <div className="grid md:grid-cols-2 gap-2">
                            {t.car?.available && (
                              <div
                                className={`rounded-lg p-3 text-sm border-2 ${
                                  t.recommended === 'car'
                                    ? 'border-green-700 bg-white'
                                    : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold text-sm">
                                    🚗 By car
                                  </span>
                                  <span className="font-bold">
                                    ${t.car.cost}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">
                                  ⏱ {t.car.duration} · 📏 {t.car.distance}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {t.car.details}
                                </p>
                              </div>
                            )}
                            {t.public?.available && (
                              <div
                                className={`rounded-lg p-3 text-sm border-2 ${
                                  t.recommended === 'public'
                                    ? 'border-green-700 bg-white'
                                    : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold text-sm">
                                    🚇 Public
                                  </span>
                                  <span className="font-bold">
                                    ${t.public.cost}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">
                                  ⏱ {t.public.duration}
                                </p>
                                <p className="text-xs text-gray-600 mb-1">
                                  {t.public.details}
                                </p>
                                {t.public.line && (
                                  <p className="text-xs text-gray-500">
                                    🚇 {t.public.line}
                                  </p>
                                )}
                                {t.public.frequency && (
                                  <p className="text-xs text-gray-500">
                                    🕐 {t.public.frequency}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {a.next && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            What's next
                          </p>
                          <p className="text-sm text-gray-700">{a.next}</p>
                        </div>
                      )}

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${a.title}, ${plan.destination}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-white"
                      >
                        🗺 Open in Google Maps
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-8">
          <p>FamilyTrip AI · Read-only itinerary view</p>
          <p className="mt-2">
            <a href="/trips" className="text-indigo-600 hover:underline">
              ← All my trips
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}