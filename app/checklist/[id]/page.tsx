'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Group travelers into role-based categories
const ROLE_GROUPS: Record<string, { label: string; subtitle: string; emoji: string }> = {
  seniors: {
    label: 'Grandparents',
    subtitle: 'Active & Health-Focused',
    emoji: '👴👵',
  },
  adults: {
    label: 'Parents',
    subtitle: 'Logistics & Coordination',
    emoji: '👨👩',
  },
  kids: {
    label: 'Children',
    subtitle: 'Kids Activity & Comfort',
    emoji: '👦👧',
  },
};

function classifyTraveler(name: string): 'seniors' | 'adults' | 'kids' {
  const n = name.toLowerCase();
  if (n.includes('grandma') || n.includes('grandpa') || n.includes('senior')) return 'seniors';
  if (n.includes('kid') || n.includes('child')) return 'kids';
  return 'adults';
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

  async function addItemToGroup(travelers: string[]) {
    if (!newItemText.trim()) return;
    // Assign to the first traveler in this group
    await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId,
        items: { [travelers[0]]: [newItemText.trim()] },
      }),
    });
    setNewItemText('');
    setOpenAddFor(null);
    load();
  }

  // Group items by role
  const grouped: Record<string, { travelers: string[]; items: any[] }> = {
    seniors: { travelers: [], items: [] },
    adults: { travelers: [], items: [] },
    kids: { travelers: [], items: [] },
  };

  items.forEach((item) => {
    const group = classifyTraveler(item.traveler);
    grouped[group].items.push(item);
    if (!grouped[group].travelers.includes(item.traveler)) {
      grouped[group].travelers.push(item.traveler);
    }
  });

  const total = items.length;
  const done = items.filter((i) => i.packed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function shareWhatsApp() {
    const lines = [`🗂 *${trip?.plan?.destination || 'Trip'} — Packing Checklist*\n`];
    Object.entries(grouped).forEach(([key, group]) => {
      if (group.items.length === 0) return;
      lines.push(`\n${ROLE_GROUPS[key].emoji} *${ROLE_GROUPS[key].label}*`);
      group.items.forEach((i) => {
        lines.push(`${i.packed ? '✅' : '⬜'} ${i.item}`);
      });
    });
    lines.push(`\n📊 ${done}/${total} packed (${pct}%)`);
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function shareTelegram() {
    const lines = [`🗂 ${trip?.plan?.destination || 'Trip'} — Packing Checklist\n`];
    Object.entries(grouped).forEach(([key, group]) => {
      if (group.items.length === 0) return;
      lines.push(`\n${ROLE_GROUPS[key].emoji} ${ROLE_GROUPS[key].label}`);
      group.items.forEach((i) => {
        lines.push(`${i.packed ? '✅' : '⬜'} ${i.item}`);
      });
    });
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://t.me/share/url?url=&text=${text}`, '_blank');
  }

  if (loading) return <p className="p-8">Loading checklist...</p>;

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
                Tailored for {trip?.plan?.destination || 'your trip'} — based on your activities and traveler needs.
              </p>
            </div>
            <div className="text-right whitespace-nowrap ml-4">
              <p className="text-sm font-semibold">
                {pct}% Packed
              </p>
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
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center mb-6">
            <p className="text-5xl mb-4">🎒</p>
            <h2 className="font-bold text-lg mb-2">No checklist yet</h2>
            <p className="text-gray-600 mb-6">
              Let AI build a smart packing list based on your activities, destination, and travelers.
            </p>
            <button
              onClick={seed}
              disabled={generating}
              className="text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              {generating ? '✨ Generating...' : '✨ AI-generate checklist'}
            </button>
          </div>
        )}

        {/* Main content: checklist + side panel */}
        {items.length > 0 && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: 3 role cards */}
            <div className="lg:col-span-2 space-y-4">
              {Object.entries(grouped).map(([key, group]) => {
                if (group.items.length === 0) return null;
                const role = ROLE_GROUPS[key];
                const groupDone = group.items.filter((i) => i.packed).length;
                const isAdding = openAddFor === key;

                return (
                  <div
                    key={key}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  >
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{role.emoji}</span>
                          <div>
                            <h2 className="font-bold text-lg">{role.label}</h2>
                            <p className="text-xs text-gray-500">
                              {role.subtitle}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {groupDone}/{group.items.length}
                        </span>
                      </div>
                    </div>

                    <div className="p-3">
                      {group.items.map((item) => (
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
                              e.key === 'Enter' &&
                              addItemToGroup(group.travelers)
                            }
                            placeholder="e.g. Toothbrush"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-700"
                            autoFocus
                          />
                          <button
                            onClick={() => addItemToGroup(group.travelers)}
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
                          onClick={() => setOpenAddFor(key)}
                          className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-green-700 hover:text-green-800 transition"
                        >
                          + Add item
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
                  Your trip assistant will send reminders and packing nudges before departure.
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

              {/* Weather hint (optional) */}
              {trip?.plan?.destination && (
                <div className="bg-blue-50 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">
                    🌦️ Weather-Aware
                  </p>
                  <p className="text-xs text-blue-900">
                    Checklist adapts to the forecast for {trip.plan.destination}.
                    Rain expected? Umbrellas already added.
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