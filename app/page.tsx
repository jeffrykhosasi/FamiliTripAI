'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('5 days in Tokyo with 2 kids and my parents');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [error, setError] = useState('');

  async function handleGenerate() {
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
      if (data.error) {
        setError('AI is busy right now. Please try again in a moment.');
      } else {
        window.location.href = `/plan/${data.id}`;
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold mb-2">FamilyTrip AI 🌏</h1>
          <p className="text-gray-600 mb-6">Stress-free family holidays, planned by AI.</p>

          <textarea
            className="w-full border rounded-lg p-3 h-32"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
          />

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '✨ Planning your trip...' : '✨ Generate itinerary'}
          </button>

          {error && <p className="mt-4 text-red-600">{error}</p>}
        </div>

        {/* Result */}
      </div>
    </main>
  );
}