'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ChecklistPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newTraveler, setNewTraveler] = useState('Dad');

  async function load() {
    const res = await fetch(`/api/checklist?tripId=${tripId}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tripId]);

  async function seed() {
    setGenerating(true);
    try {
      // Load trip plan
      const tripRes = await fetch(`/api/plan/${tripId}`);
      const tripData = await tripRes.json();
      if (tripData.error) {
        alert('Could not load trip plan');
        setGenerating(false);
        return;
      }

      // Ask AI to generate checklist
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

      // Save to DB
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

  async function addItem() {
    if (!newItem.trim()) return;
    await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId,
        items: { [newTraveler]: [newItem.trim()] },
      }),
    });
    setNewItem('');
    load();
  }

  const grouped = items.reduce((acc: any, i) => {
    (acc[i.traveler] ||= []).push(i);
    return acc;
  }, {});

  const total = items.length;
  const done = items.filter((i) => i.packed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) return <p className="p-8">Loading checklist...</p>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold mb-2">Family Packing Dashboard</h1>
          <p className="text-gray-600 mb-4">
            Every traveler, every item, all in one place.
          </p>

          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {done}/{total} packed ({pct}%)
            </span>
          </div>

          {pct === 100 && total > 0 && (
            <p className="text-green-600 font-medium text-sm">
              🎉 All packed! Ready for takeoff.
            </p>
          )}
        </div>

        {items.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center mb-6">
            <p className="text-gray-600 mb-4">
              No checklist yet. Let AI build one based on your activities?
            </p>
            <button
              onClick={seed}
              disabled={generating}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {generating ? '✨ Generating...' : '✨ AI-generate checklist'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {Object.entries(grouped).map(([traveler, list]: any) => {
            const tDone = list.filter((i: any) => i.packed).length;
            return (
              <div key={traveler} className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-lg">{traveler}</h2>
                  <span className="text-xs text-gray-500">
                    {tDone}/{list.length}
                  </span>
                </div>
                {list.map((i: any) => (
                  <div key={i.id} className="flex items-center gap-2 py-1 group">
                    <input
                      type="checkbox"
                      checked={i.packed}
                      onChange={(e) => toggle(i.id, e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className={i.packed ? 'line-through text-gray-400 flex-1' : 'flex-1'}>
                      {i.item}
                    </span>
                    <button
                      onClick={() => remove(i.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="font-semibold mb-3">Add item</h3>
            <div className="flex gap-2">
              <select
                value={newTraveler}
                onChange={(e) => setNewTraveler(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                {Object.keys(grouped).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="e.g. Toothbrush"
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                onClick={addItem}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}