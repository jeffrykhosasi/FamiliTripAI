'use client';

import { useState } from 'react';

export default function TestPlan() {
  const [prompt, setPrompt] = useState('5 days in Tokyo with 2 kids and my parents');
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    setPlan(null);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setPlan(data.plan);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Test: AI Itinerary</h1>
      <textarea
        className="w-full border rounded-lg p-3 h-24"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        onClick={generate}
        disabled={loading}
        className="mt-3 bg-indigo-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate'}
      </button>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {plan && (
        <div className="mt-6">
          <h2 className="text-xl font-bold">{plan.destination}</h2>
          <p className="text-gray-500 mb-4">
            {plan.travelers?.map((t: any) => `${t.name} (${t.role})`).join(' · ')}
          </p>
          {plan.days?.map((day: any) => (
            <div key={day.day} className="mb-6 bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold mb-3">Day {day.day} — {day.date}</h3>
              {day.activities?.map((a: any, i: number) => (
                <div key={i} className="border-t pt-2 mt-2">
                  <p className="font-medium">{a.time} — {a.title}</p>
                  <p className="text-sm text-gray-600">{a.description}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}