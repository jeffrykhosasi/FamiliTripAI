'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function Home() {
  const [prompt, setPrompt] = useState('5 days in Tokyo with 2 kids and my parents');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) {
        setError('AI is busy right now. Please try again in a moment.');
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
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end mb-4">
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">{user.email}</span>
              <button
                onClick={signOut}
                className="text-indigo-600 hover:underline"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
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
      </div>
    </main>
  );
}