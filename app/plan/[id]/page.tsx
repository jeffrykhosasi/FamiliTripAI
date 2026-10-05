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

  function updateActivity(di: number, ai: number, field: string, value: string) {
    const next = structuredClone(plan);
    next.days[di].activities[ai][field] = value;
    setPlan(next);
    setSaved(false);
  }

  function removeActivity(di: number, ai: number) {
    const next = structuredClone(plan);
    next.days[di].activities.splice(ai, 1);
    setPlan(next);
    setSaved(false);
  }

  async function saveChanges() {
    setSaving(true);
    await fetch(`/api/plan/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    setSaving(false);
    setSaved(true);
  }

  async function confirmAndBook() {
    // Save first, then go to booking page (we'll build that next)
    await saveChanges();
    window.location.href = `/book/${id}`;
  }

  if (loading) return <p className="p-8">Loading trip...</p>;
  if (error) return <p className="p-8 text-red-600">Error: {error}</p>;
  if (!plan) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold mb-2">{plan.destination}</h1>
          <p className="text-gray-500 mb-2">
            {plan.travelers?.map((t: any) => `${t.name} (${t.role})`).join(' · ')}
          </p>
          <p className="text-xs text-gray-400">Trip ID: {id}</p>
        </div>

        {/* Days */}
        {plan.days?.map((day: any, di: number) => (
          <div key={di} className="bg-white rounded-2xl shadow-xl p-8 mb-4">
            <h2 className="text-xl font-semibold mb-4">
              Day {day.day} — {day.date}
            </h2>

            {day.activities?.map((a: any, ai: number) => (
              <div key={ai} className="border border-gray-200 rounded-lg p-4 mb-3">
                <div className="flex gap-2 mb-2">
                  <input
                    className="flex-1 font-medium border-b border-gray-300 focus:border-indigo-500 outline-none"
                    value={a.title}
                    onChange={(e) => updateActivity(di, ai, 'title', e.target.value)}
                  />
                  <input
                    className="w-24 border-b border-gray-300 focus:border-indigo-500 outline-none text-sm"
                    value={a.time}
                    onChange={(e) => updateActivity(di, ai, 'time', e.target.value)}
                  />
                  <button
                    onClick={() => removeActivity(di, ai)}
                    className="text-red-500 hover:text-red-700 px-2"
                    title="Delete activity"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  className="w-full text-sm text-gray-600 border border-gray-200 rounded p-2 focus:border-indigo-500 outline-none"
                  value={a.description}
                  onChange={(e) => updateActivity(di, ai, 'description', e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2 mt-2">
                  {a.kidFriendly && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      👶 Kid friendly
                    </span>
                  )}
                  {a.elderlyFriendly && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      👴 Elderly friendly
                    </span>
                  )}
                </div>
              </div>
            ))}

            {day.activities?.length === 0 && (
              <p className="text-gray-400 text-sm italic">No activities left for this day.</p>
            )}
          </div>
        ))}

        {/* Actions */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sticky bottom-4">
          <div className="flex gap-3">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="flex-1 border border-indigo-600 text-indigo-600 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
            </button>
            <button
              onClick={confirmAndBook}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold"
            >
              ✅ Confirm & book
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}