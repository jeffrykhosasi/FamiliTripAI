'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Determine emoji + subtitle from traveler name
function getTravelerMeta(name: string): { emoji: string; subtitle: string } {
  const n = (name || '').toLowerCase();
  if (n.includes('grandma') || n.includes('grandmother')) {
    return { emoji: '👵', subtitle: 'Comfort & Health' };
  }
  if (n.includes('grandpa') || n.includes('grandfather')) {
    return { emoji: '👴', subtitle: 'Comfort & Mobility' };
  }
  if (n.includes('mom') || n.includes('mother')) {
    return { emoji: '👩', subtitle: 'Logistics & Coordination' };
  }
  if (n.includes('dad') || n.includes('father')) {
    return { emoji: '👨', subtitle: 'Logistics & Coordination' };
  }
  if (n.includes('kid') || n.includes('child')) {
    return { emoji: '🧒', subtitle: 'Kids Activity & Comfort' };
  }
  if (n.includes('senior')) {
    return { emoji: '👴', subtitle: 'Comfort & Health' };
  }
  return { emoji: '👤', subtitle: 'Traveler' };
}

export default function ChecklistPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [items, setItems] = useState<any[]>([]);
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openAddFor, setOpenAddFor] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');

  async function load() {
    const [itemsRes, tripRes] = await Promise.all([
      fetch(`/api/checklist?tripId=${tripId}`).then((r) => r.json()),
      fetch(`/api/plan/${tripId}`).then((r) => r.json()),
    ]);
    setItems(Array.isArray(itemsRes) ? itemsRes : []);
    setTrip(tripRes);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tripId]);

  async function seed() {
    setGenerating(true);
    try {
      const tripRes = await fetch(`/api/plan/${tripId}`);
      const tripData = await tripRes.json();
      if (tripData.error) {
        alert('Could not load trip plan');
        setGenerating(false);
        return;
      }

      const res = await fetch('/api/checklist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: tripData.plan }),
      });
      const data = await res.json();
      if (data.error) {
        alert('AI busy, try again in a moment');
        setGenerating(false);
        return;
      }

      await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, items: data.checklists }),
      });

      await load();
    } catch {
      alert('Something went wrong');
    }
    setGenerating(false);
  }

  async function toggle(id: string, packed: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, packed } : i)));
    await fetch('/api/checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, packed }),
    });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/checklist?id=${id}`, { method: 'DELETE' });
  }

  async function addItemToTraveler(traveler: string) {
    if (!newItemText.trim()) return;
    await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId,
        items: { [traveler]: [newItemText.trim()] },
      }),
    });
    setNewItemText('');
    setOpenAddFor(null);
    load();
  }

  // Group items by INDIVIDUAL traveler (not by role)
  const grouped: Record<string, any[]> = {};
  items.forEach((item) => {
    if (!grouped[item.traveler]) grouped[item.traveler] = [];
    grouped[item.traveler].push(item);
  });

  const total = items.length;
  const done = items.filter((i) => i.packed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function shareWhatsApp() {
    const lines = [
      `🗂 *${trip?.plan?.destination || 'Trip'} — Packing Checklist*\n`,
    ];
    Object.entries(grouped).forEach(([traveler, travelerItems]) => {
      if (travelerItems.length === 0) return;
      lines.push(`\n*${traveler}*`);
      travelerItems.forEach((i: any) => {
        lines.push(`${i.packed ? '✅' : '⬜'} ${i.item}`);
      });
    });
    lines.push(`\n📊 ${done}/${total} packed (${pct}%)`);
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function shareTelegram() {
    const lines = [
      `🗂 ${trip?.plan?.destination || 'Trip'} — Packing Checklist\n`,
    ];
    Object.entries(grouped).forEach(([traveler, travelerItems]) => {
      if (travelerItems.length === 0) return;
      lines.push(`\n${traveler}`);
      travelerItems.forEach((i: any) => {
        lines.push(`${i.packed ? '✅' : '⬜'} ${i.item}`);
      });
    });
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://t.me/share/url?url=&text=${text}`, '_blank');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </nav>
        <div className="max-w-6xl mx-auto p-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 mb-6 animate-pulse">
            <div className="h-8 w-72 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-96 bg-gray-200 rounded mb-6" />
            <div className="h-3 bg-gray-200 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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
              href={`/book/${tripId}`}
              className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Bookings
            </a>
            <a
              href={`/recap/${tripId}`}
              className="px-3 py-1.5 rounded-lg text-white font-medium"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              🎬 Recap
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">
                Your Smart Family Packing Checklist
              </h1>
              <p className="text-gray-500 text-sm">
                Tailored for {trip?.plan?.destination || 'your trip'} — based on your
                activities and traveler needs.
              </p>
            </div>
            <div className="text-right whitespace-nowrap ml-4">
              <p className="text-sm font-semibold">{pct}% Packed</p>
              <p className="text-xs text-gray-500">
                {done}/{total} items
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: '#0d4d3d',
              }}
            />
          </div>

          {pct === 100 && total > 0 && (
            <p className="text-green-700 font-medium text-sm mt-3">
              🎉 All packed! Ready for takeoff.
            </p>
          )}
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div
            className="bg-white rounded-2xl shadow-sm p-12 text-center mb-6 relative overflow-hidden"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 15%, rgba(13, 77, 61, 0.05) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(212, 165, 116, 0.05) 0%, transparent 50%)',
            }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5 text-4xl"
              style={{ backgroundColor: '#e8f0ed' }}
            >
              🎒
            </div>
            <h2 className="text-2xl font-bold mb-3">
              Nothing packed yet — let's fix that
            </h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto leading-relaxed">
              Our AI reads your itinerary and generates a smart packing list for each
              traveler — tailored to the destination, weather, and activities.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              <span className="text-xs bg-green-50 text-green-800 px-3 py-1.5 rounded-full font-medium">
                ✓ Kid-friendly items
              </span>
              <span className="text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-full font-medium">
                ✓ Senior medications
              </span>
              <span className="text-xs bg-yellow-50 text-yellow-800 px-3 py-1.5 rounded-full font-medium">
                ✓ Weather-aware
              </span>
            </div>
            <button
              onClick={seed}
              disabled={generating}
              className="text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 hover:opacity-90 transition"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              {generating ? '✨ Generating your list...' : '✨ Generate my packing list'}
            </button>
            <p className="text-xs text-gray-400 mt-4">Takes about 10 seconds</p>
          </div>
        )}

        {/* Main content: checklist + side panel */}
        {items.length > 0 && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: per-traveler cards */}
            <div className="lg:col-span-2 space-y-4">
              {Object.entries(grouped).map(
                ([traveler, travelerItems]: [string, any]) => {
                  if (travelerItems.length === 0) return null;
                  const meta = getTravelerMeta(traveler);
                  const groupDone = travelerItems.filter((i: any) => i.packed).length;
                  const isAdding = openAddFor === traveler;

                  return (
                    <div
                      key={traveler}
                      className="bg-white rounded-2xl shadow-sm overflow-hidden"
                    >
                      <div className="p-5 border-b border-gray-100">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{meta.emoji}</span>
                            <div>
                              <h2 className="font-bold text-lg">{traveler}</h2>
                              <p className="text-xs text-gray-500">{meta.subtitle}</p>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">
                            {groupDone}/{travelerItems.length}
                          </span>
                        </div>
                      </div>

                      <div className="p-3">
                        {travelerItems.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 group"
                          >
                            <input
                              type="checkbox"
                              checked={item.packed}
                              onChange={(e) => toggle(item.id, e.target.checked)}
                              className="mt-0.5 w-4 h-4 cursor-pointer flex-shrink-0"
                              style={{ accentColor: '#0d4d3d' }}
                            />
                            <span
                              className={`flex-1 text-sm ${
                                item.packed
                                  ? 'line-through text-gray-400'
                                  : 'text-gray-800'
                              }`}
                            >
                              {item.item}
                            </span>
                            <button
                              onClick={() => remove(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs transition"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="px-3 pb-3">
                        {isAdding ? (
                          <div className="flex gap-2">
                            <input
                              value={newItemText}
                              onChange={(e) => setNewItemText(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === 'Enter' && addItemToTraveler(traveler)
                              }
                              placeholder="e.g. Toothbrush"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-700"
                              autoFocus
                            />
                            <button
                              onClick={() => addItemToTraveler(traveler)}
                              className="text-white px-4 py-2 rounded-lg text-sm font-medium"
                              style={{ backgroundColor: '#0d4d3d' }}
                            >
                              Add
                            </button>
                            <button
                              onClick={() => {
                                setOpenAddFor(null);
                                setNewItemText('');
                              }}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setOpenAddFor(traveler)}
                            className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-green-700 hover:text-green-800 transition"
                          >
                            + Add item
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* Right: side panel */}
            <div className="space-y-4">
              {/* Share panel */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-lg mb-1">Quick Share & Reminders</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Send the checklist to family members
                </p>

                <button
                  onClick={shareWhatsApp}
                  className="w-full py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium mb-2 flex items-center justify-center gap-2"
                >
                  <span>💬</span> Share on WhatsApp
                </button>
                <button
                  onClick={shareTelegram}
                  className="w-full py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <span>✈️</span> Share on Telegram
                </button>
              </div>

              {/* Reminders panel */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-2">
                  🤖 AI Companion reminds you
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Your trip assistant will send reminders and packing nudges before
                  departure.
                </p>

                <a
                  href={`https://t.me/familytrip_ai_bot?start=${tripId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center text-white py-3 rounded-lg font-semibold text-sm"
                  style={{ backgroundColor: '#0088cc' }}
                >
                  📱 Open in Telegram
                </a>
              </div>

              {/* Weather hint */}
              {trip?.plan?.destination && (
                <div className="bg-blue-50 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">
                    🌦️ Weather-Aware
                  </p>
                  <p className="text-xs text-blue-900">
                    Checklist adapts to the forecast for {trip.plan.destination}. Rain
                    expected? Umbrellas already added.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}