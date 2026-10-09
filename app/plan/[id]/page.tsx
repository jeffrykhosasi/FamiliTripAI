'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Transport = {
  recommended?: 'car' | 'public';
  car?: {
    available: boolean;
    duration: string;
    distance: string;
    cost: number;
    details: string;
  };
  public?: {
    available: boolean;
    duration: string;
    cost: number;
    details: string;
    line?: string;
    frequency?: string;
    walkTime?: string;
  };
};

export default function TripPage() {
  const params = useParams();
  const id = params.id as string;
  const [trip, setTrip] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [removingCar, setRemovingCar] = useState(false);
  const [addingCar, setAddingCar] = useState(false);

  useEffect(() => {
    fetch(`/api/plan/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setTrip(data);
          setPlan(data.plan);
        }
        setLoading(false);
      });
  }, [id]);

  function updateActivity(di: number, ai: number, field: string, value: any) {
    const next = structuredClone(plan);
    next.dailyPlans[di].activities[ai][field] = value;
    setPlan(next);
    setSaved(false);
  }

  function removeActivity(di: number, ai: number) {
    const next = structuredClone(plan);
    next.dailyPlans[di].activities.splice(ai, 1);
    setPlan(next);
    setSaved(false);
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const res = await fetch(`/api/plan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      // Reset "Saved" indicator after 2 seconds
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert('Could not save: ' + e.message);
    }
    setSaving(false);
  }

  async function removeRentalCar() {
    if (!confirm('Remove the rental car and switch to public transport?')) return;
    setRemovingCar(true);
    try {
      const res = await fetch(`/api/plan/${id}/remove-car`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        alert('AI busy, try again in a moment');
      } else {
        setPlan(data.plan);
        setSaved(false);
      }
    } catch {
      alert('Something went wrong');
    }
    setRemovingCar(false);
  }

    async function addRentalCar() {
    if (!confirm('Add a rental car for the whole trip? This will replace public transport.')) return;
    setAddingCar(true);
    try {
      const res = await fetch(`/api/plan/${id}/add-car`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        alert('AI busy, try again in a moment');
      } else {
        setPlan(data.plan);
        setSaved(false);
      }
    } catch {
      alert('Something went wrong');
    }
    setAddingCar(false);
  }

  function confirmAndBook() {
    window.location.href = `/book/${id}`;
  }

  if (loading) return <p className="p-8">Loading trip...</p>;
  if (error) return <p className="p-8 text-red-600">Error: {error}</p>;
  if (!plan) return null;

  const breakdown = plan.budgetBreakdown || {};
  const budget = trip?.budget_usd || 0;
  const car = plan.rentalCar;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/" className="text-xl font-bold" style={{ color: '#0d4d3d' }}>
              FamilyTrip
            </a>
            <div className="hidden md:flex gap-6 text-sm font-medium text-gray-700">
              <a href="/" className="hover:text-gray-900">Plan new trip</a>
              <a href="/trips" className="hover:text-gray-900">My trips</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:inline">
              {plan.destination} · {plan.days} days
            </span>
            <a
              href="/trips"
              className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
            >
              🗂 My trips
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-6" style={{ borderLeft: '4px solid #0d4d3d' }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-1">{plan.destination}</h1>
              <p className="text-gray-500 text-sm">
                {plan.startDate} → {plan.returnDate} · {plan.days} days
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Budget</p>
              <p className="text-2xl font-bold">${budget.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Accommodation', value: breakdown.accommodation, icon: '🏨' },
              { label: 'Food', value: breakdown.food, icon: '🍽️' },
              { label: 'Transport', value: breakdown.transport, icon: '🚇' },
              { label: 'Activities', value: breakdown.activities, icon: '🎫' },
            ].map((b) => (
              <div key={b.label} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>{b.icon}</span>
                  <span className="text-xs text-gray-500">{b.label}</span>
                </div>
                <p className="font-semibold">${(b.value || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>

          {plan.transportPlan && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {car?.recommended ? (
                  <>
                    <span className="text-lg">🚗</span>
                    <span className="font-semibold text-sm">This trip uses a rental car</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">🚇</span>
                    <span className="font-semibold text-sm">This trip uses public transport</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">{plan.transportPlan}</p>
            </div>
          )}
        </div>

        {/* Rental car card */}
        {car && car.recommended ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6" style={{ borderLeft: '4px solid #0d4d3d' }}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold text-green-800 mb-1">🚗 RENTAL CAR</p>
                <h2 className="text-xl font-bold">{car.type}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total ({car.days} days)</p>
                <p className="text-2xl font-bold">${car.totalPrice}</p>
                <p className="text-xs text-gray-500">${car.dailyPrice}/day</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Pickup</p>
                <p>{car.pickupLocation}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Drop-off</p>
                <p>{car.dropoffLocation}</p>
              </div>
            </div>

            <button
              onClick={removeRentalCar}
              disabled={removingCar}
              className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
            >
              {removingCar ? '🔄 Finding public transport alternatives...' : '✕ Remove rental car & use public transport instead'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">🚇 PUBLIC TRANSPORT</p>
              <p className="text-sm text-gray-600">
                Your trip is planned with public transport. Want to switch to a rental car?
              </p>
            </div>
            <button
              onClick={addRentalCar}
              disabled={addingCar}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50 whitespace-nowrap ml-4"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              {addingCar ? '🔄 Adding...' : '+ Add rental car'}
            </button>
          </div>
        )} 

        {/* Days */}
        {plan.dailyPlans?.map((day: any, di: number) => (
          <div key={di} className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-white text-sm font-bold rounded-lg px-3 py-1.5" style={{ backgroundColor: '#0d4d3d' }}>
                Day {day.day}
              </span>
              <span className="text-gray-500 text-sm">{day.date}</span>
              {day.theme && <span className="text-sm font-medium text-gray-700">— {day.theme}</span>}
            </div>

            {day.activities?.map((a: any, ai: number) => {
              const key = `${di}-${ai}`;
              const isExpanded = expandedActivity === key;
              const t = a.transport;
              
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
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedActivity(isExpanded ? null : key)}
                  >
                    <span className="text-sm font-mono text-gray-500 pt-0.5 w-14">{a.time}</span>
                    <div className="flex-1">
                      {a.isRentalCarEvent && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-green-800 bg-green-200 px-1.5 py-0.5 rounded mr-2">
                          🚗 Rental Car Event
                        </span>
                      )}
                      {a.isParentsDayOffEvent && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-yellow-800 bg-yellow-200 px-1.5 py-0.5 rounded mr-2">
                          ✨ Parents' Day Off
                        </span>
                      )}
                      <input
                        value={a.title}
                        onChange={(e) => updateActivity(di, ai, 'title', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold w-full outline-none focus:bg-gray-50 rounded px-1"
                      />
                      <div className="flex flex-wrap gap-2 mt-1">
                        {a.kidFriendly && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">👶 Kid</span>}
                        {a.elderlyFriendly && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">👴 Senior</span>}
                          {t && (
                          <>
                            {t.car?.available && (
                              <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                🚗 {t.car.duration} · ${t.car.cost}
                              </span>
                            )}
                            {t.public?.available && (
                              <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                🚇 {t.public.duration} · ${t.public.cost}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${a.cost_usd || 0}</p>
                      <p className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">WHAT TO DO</p>
                        <textarea
                          value={a.description}
                          onChange={(e) => updateActivity(di, ai, 'description', e.target.value)}
                          className="w-full text-sm bg-white border border-gray-200 rounded p-2 outline-none focus:border-green-700"
                          rows={2}
                        />
                      </div>

                      {t && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">🚗🚇 HOW TO GET THERE — pick your option</p>
                          <div className="grid md:grid-cols-2 gap-3">
                            {/* Car option */}
                            {t.car?.available && (
                              <div
                                className={`rounded-lg p-3 text-sm border-2 ${
                                  t.recommended === 'car'
                                    ? 'border-green-700 bg-green-50'
                                    : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold">
                                    🚗 By car
                                    {t.recommended === 'car' && (
                                      <span className="ml-2 text-[10px] bg-green-700 text-white px-1.5 py-0.5 rounded">
                                        Your Mode
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-right">
                                    <span className="font-bold block">${t.car.cost}</span>
                                    <span className="text-[9px] text-gray-500">fuel + parking</span>
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">
                                  ⏱️ {t.car.duration} · 📏 {t.car.distance}
                                </p>
                                <p className="text-xs text-gray-600">{t.car.details}</p>
                              </div>
                            )}

                            {/* Public transport option */}
                            {t.public?.available && (
                              <div
                                className={`rounded-lg p-3 text-sm border-2 ${
                                  t.recommended === 'public'
                                    ? 'border-green-700 bg-green-50'
                                    : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold">
                                    🚇 Public transport
                                    {t.recommended === 'public' && (
                                      <span className="ml-2 text-[10px] bg-green-700 text-white px-1.5 py-0.5 rounded">
                                        Your Mode
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-bold">${t.public.cost}</span>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">⏱️ {t.public.duration}</p>
                                <p className="text-xs text-gray-600 mb-1">{t.public.details}</p>
                                {t.public.line && (
                                  <p className="text-xs text-gray-500">🚇 {t.public.line}</p>
                                )}
                                {t.public.frequency && (
                                  <p className="text-xs text-gray-500">🕐 {t.public.frequency}</p>
                                )}
                                {t.public.walkTime && (
                                  <p className="text-xs text-gray-500">🚶 {t.public.walkTime}</p>
                                )}
                              </div>
                            )}
                          </div>
                          {(plan as any).rentalCar?.recommended && !(t as any).car?.available && (
                            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                              ⚠️ No car access here — this area is car-free. Take public transport or walk.
                            </p>
                          )}

                          {!(plan as any).rentalCar?.recommended && !(t as any).public?.available && (
                            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                              ⚠️ No public transport to this spot — you'll need a car or taxi.
                            </p>
                          )}

                          {t.alternativeHint && (
                            <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3 flex gap-2">
                              <span className="text-blue-600">💡</span>
                              <p className="text-xs text-blue-900">
                                {t.alternativeHint}
                              </p>
                            </div>
                        )} 
                        </div>
                      )}

                      {a.next && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">⏭️ WHAT'S NEXT</p>
                          <p className="text-sm bg-white border border-gray-200 rounded p-2">{a.next}</p>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeActivity(di, ai);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        ✕ Remove this activity
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Sticky action bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 sticky bottom-4">
          <a
            href="/trips"
            className="px-4 py-3 rounded-lg border border-gray-300 font-semibold text-sm hover:bg-gray-50 whitespace-nowrap"
          >
            🗂 My trips
          </a>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="flex-1 border-2 py-3 rounded-lg font-semibold disabled:opacity-50"
            style={{ borderColor: '#0d4d3d', color: '#0d4d3d' }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
          </button>
          <button
            onClick={confirmAndBook}
            className="flex-1 text-white py-3 rounded-lg font-semibold"
            style={{ backgroundColor: '#0d4d3d' }}
          >
            ✅ Confirm & book
          </button>
        </div>
      </main>
    </div>
  );
}