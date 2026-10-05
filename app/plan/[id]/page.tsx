'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function TripPage() {
  const params = useParams();
  const id = params.id as string;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/plan/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTrip(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p className="p-8">Loading trip...</p>;
  if (error) return <p className="p-8 text-red-600">Error: {error}</p>;
  if (!trip) return null;

  const plan = trip.plan;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold mb-2">{plan.destination}</h1>
          <p className="text-gray-500 mb-2">
            {plan.travelers?.map((t: any) => `${t.name} (${t.role})`).join(' · ')}
          </p>
          <p className="text-sm text-gray-400">Trip ID: {id}</p>
        </div>

        {plan.days?.map((day: any) => (
          <div key={day.day} className="bg-white rounded-2xl shadow-xl p-8 mb-4">
            <h2 className="text-xl font-semibold mb-4">
              Day {day.day} — {day.date}
            </h2>
            {day.activities?.map((a: any, i: number) => (
              <div key={i} className="border-l-4 border-indigo-200 pl-4 mb-4">
                <p className="font-medium">
                  <span className="text-indigo-600">{a.time}</span> — {a.title}
                </p>
                <p className="text-sm text-gray-600">{a.description}</p>
                <div className="flex gap-2 mt-1">
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
          </div>
        ))}
      </div>
    </main>
  );
}