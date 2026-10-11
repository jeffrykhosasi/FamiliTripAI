'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function TripPage() {
  const params = useParams();
  const id = params.id as string;
  const [trip, setTrip] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeActivity, setActiveActivity] = useState<{ di: number; ai: number } | null>(null);
  const [removingCar, setRemovingCar] = useState(false);
  const [addingCar, setAddingCar] = useState(false);

  useEffect(() => {
    fetch(`/api/plan/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          if (data.status === 'booked') {
            window.location.href = `/book/${id}`;
            return;
          }
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
    setActiveActivity(null);
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
      if (data.error) alert('AI busy, try again in a moment');
      else {
        setPlan(data.plan);
        setSaved(false);
      }
    } catch {
      alert('Something went wrong');
    }
    setRemovingCar(false);
  }

  async function addRentalCar() {
    if (!confirm('Add a rental car for the whole trip?')) return;
    setAddingCar(true);
    try {
      const res = await fetch(`/api/plan/${id}/add-car`, { method: 'POST' });
      const data = await res.json();
      if (data.error) alert('AI busy, try again in a moment');
      else {
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
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
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
        {/* Hero card */}
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
              <p className="text-2xl font-bold">${budget.toLocaleString('en-US')}</p>
            </div>
          </div>

          {/* Budget breakdown */}
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
                <p className="font-semibold">${(b.value || 0).toLocaleString('en-US')}</p>
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
            {car.note && <p className="text-sm text-gray-600 italic mb-4">💡 {car.note}</p>}
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
              <span
                className="text-white text-sm font-bold rounded-lg px-3 py-1.5"
                style={{ backgroundColor: '#0d4d3d' }}
              >
                Day {day.day}
              </span>
              <span className="text-gray-500 text-sm">{day.date}</span>
              {day.theme && <span className="text-sm font-medium text-gray-700">— {day.theme}</span>}
            </div>

            {day.activities?.map((a: any, ai: number) => {
              const t = a.transport;
              const isRental = a.isRentalCarEvent;
              const isParentsDayOff = a.isParentsDayOffEvent;

              return (
                <button
                  key={ai}
                  onClick={() => setActiveActivity({ di, ai })}
                  className={`w-full text-left rounded-xl mb-3 p-4 hover:shadow-md transition ${
                    isRental
                      ? 'border-2 border-green-700 bg-green-50'
                      : isParentsDayOff
                      ? 'border-2 border-yellow-500 bg-yellow-50'
                      : 'border border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-mono text-gray-500 pt-0.5 w-14">
                      {a.time}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {isRental && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-800 bg-green-200 px-1.5 py-0.5 rounded">
                            🚗 Rental Car
                          </span>
                        )}
                        {isParentsDayOff && (
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
                        {t?.car?.available && (
                          <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            🚗 {t.car.duration} · ${t.car.cost}
                          </span>
                        )}
                        {t?.public?.available && (
                          <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            🚇 {t.public.duration} · ${t.public.cost}
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">{a.description}</p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-sm font-semibold">${a.cost_usd || 0}</p>
                      <p className="text-gray-400 text-xs">View →</p>
                    </div>
                  </div>
                </button>
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

      {/* Modal */}
      {activeActivity && (
        <ActivityModal
          activity={plan.dailyPlans[activeActivity.di].activities[activeActivity.ai]}
          day={plan.dailyPlans[activeActivity.di].day}
          dayTheme={plan.dailyPlans[activeActivity.di].theme}
          travelers={plan.travelers || []}
          destination={plan.destination}
          onClose={() => setActiveActivity(null)}
          onUpdate={(field, value) => updateActivity(activeActivity.di, activeActivity.ai, field, value)}
          onRemove={() => removeActivity(activeActivity.di, activeActivity.ai)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ACTIVITY MODAL — the redesigned detail view
// ═══════════════════════════════════════════════════════
function ActivityModal({
  activity,
  day,
  dayTheme,
  travelers,
  destination,
  onClose,
  onUpdate,
  onRemove,
}: {
  activity: any;
  day: number;
  dayTheme?: string;
  travelers: any[];
  destination: string;
  onClose: () => void;
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
}) {
  const a = activity;
  const t = a.transport || {};
  const [editedTitle, setEditedTitle] = useState(a.title || '');
  const [editedDesc, setEditedDesc] = useState(a.description || '');

  // Split description into highlights (by sentence)
  const highlights = (a.description || '')
    .split(/[.!?]+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 10)
    .slice(0, 4);

  // Pick an emoji based on activity type
  function pickEmoji(title: string): string {
    const t = (title || '').toLowerCase();
    if (t.includes('temple') || t.includes('shrine') || t.includes('castle')) return '⛩️';
    if (t.includes('museum') || t.includes('gallery') || t.includes('art')) return '🎨';
    if (t.includes('park') || t.includes('garden') || t.includes('zoo')) return '🌳';
    if (t.includes('dinner') || t.includes('lunch') || t.includes('restaurant') || t.includes('food') || t.includes('dining')) return '🍽️';
    if (t.includes('cruise') || t.includes('boat') || t.includes('river')) return '🚤';
    if (t.includes('disney') || t.includes('universal') || t.includes('theme park')) return '🎢';
    if (t.includes('shopping') || t.includes('market')) return '🛍️';
    if (t.includes('spa') || t.includes('onsen') || t.includes('relax')) return '💆';
    if (t.includes('kids') || t.includes('play')) return '🧸';
    if (t.includes('airport') || t.includes('flight')) return '✈️';
    if (t.includes('pick up') || t.includes('return rental')) return '🚗';
    if (t.includes('hotel') || t.includes('check-in') || t.includes('check in')) return '🏨';
    if (t.includes('view') || t.includes('tower') || t.includes('peak')) return '🌆';
    if (t.includes('train') || t.includes('station')) return '🚆';
    return '📍';
  }

  const emoji = pickEmoji(a.title);
  const heroImage = `https://picsum.photos/seed/${encodeURIComponent(a.title)}/800/600`;

  function saveAndClose() {
    if (editedTitle !== a.title) onUpdate('title', editedTitle);
    if (editedDesc !== a.description) onUpdate('description', editedDesc);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-6 flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-4">
            <input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-2xl font-bold w-full outline-none focus:bg-gray-50 rounded px-2 py-1"
            />
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 px-2">
              <span>Day {day}</span>
              {dayTheme && (
                <>
                  <span>·</span>
                  <span>{dayTheme}</span>
                </>
              )}
              <span>·</span>
              <span className="font-mono">{a.time}</span>
            </div>
          </div>
          <button
            onClick={saveAndClose}
            className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
          >
            <span className="text-xl">✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid md:grid-cols-3 gap-6">
          {/* Left: image */}
          <div className="md:col-span-1">
            <div className="aspect-square rounded-xl overflow-hidden relative"
                 style={{
                   background: 'linear-gradient(135deg, #0d4d3d 0%, #2a7a63 100%)',
                 }}>
              <img
                src={heroImage}
                alt={a.title}
                className="w-full h-full object-cover absolute inset-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Emoji fallback (shows through if image fails) */}
              <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-90 pointer-events-none">
                {emoji}
              </div>
              {/* Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {a.kidFriendly && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  👶 Kid friendly
                </span>
              )}
              {a.elderlyFriendly && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  👴 Senior access
                </span>
              )}
            </div>
          </div>

          {/* Middle: transport */}
          <div className="md:col-span-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              🚗 How to get there
            </p>
            <div className="space-y-3">
              {t.car?.available && (
                <div
                  className={`rounded-lg p-3 text-sm border-2 ${
                    t.recommended === 'car'
                      ? 'border-green-700 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm">🚗 By car</span>
                    <span className="font-bold">${t.car.cost}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">
                    ⏱ {t.car.duration} · 📏 {t.car.distance}
                  </p>
                  <p className="text-xs text-gray-600">{t.car.details}</p>
                </div>
              )}

              {t.public?.available && (
                <div
                  className={`rounded-lg p-3 text-sm border-2 ${
                    t.recommended === 'public'
                      ? 'border-green-700 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm">🚇 Public</span>
                    <span className="font-bold">${t.public.cost}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">⏱ {t.public.duration}</p>
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
          </div>

          {/* Right: at a glance */}
          <div className="md:col-span-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              ℹ️ At a glance
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Time</span>
                <span className="font-medium">{a.time}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Cost</span>
                <span className="font-medium">${a.cost_usd || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Family</span>
                <span className="font-medium">
                  {a.kidFriendly && a.elderlyFriendly
                    ? 'All ages'
                    : a.kidFriendly
                    ? 'Kids OK'
                    : a.elderlyFriendly
                    ? 'Seniors OK'
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Travelers</span>
                <span className="font-medium">{travelers.length}</span>
              </div>
            </div>
            {a.next && (
              <div className="mt-4 bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">⏭ What's next</p>
                <p className="text-xs text-blue-900">{a.next}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: About + Highlights + Actions */}
        <div className="px-6 pb-6">
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              About this activity
            </p>
            <textarea
              value={editedDesc}
              onChange={(e) => setEditedDesc(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 outline-none focus:border-green-700 resize-none"
            />
          </div>

          {highlights.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Highlights
              </p>
              <ul className="space-y-1">
                {highlights.map((h: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-green-700">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${a.title}, ${destination}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium text-center"
            >
              🗺 Open in Google Maps
            </a>
            <button
              onClick={onRemove}
              className="px-4 py-2.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium"
            >
              🗑 Remove
            </button>
            <button
              onClick={saveAndClose}
              className="flex-1 min-w-[160px] text-white px-4 py-2.5 rounded-lg font-semibold text-sm"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              ✓ Save & close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}