'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
  'https://images.unsplash.com/photo-1533050487297-09b450131914?w=800&q=80',
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
];

export default function RecapPage() {
  const params = useParams();
  const id = params.id as string;
  const [trip, setTrip] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    fetch(`/api/plan/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setTrip(data);
      });
  }, [id]);

  useEffect(() => {
    if (!playing || !trip) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % PLACEHOLDER_PHOTOS.length);
    }, 2500);
    return () => clearInterval(t);
  }, [playing, trip]);

  if (!trip) return <p className="p-8 text-white">Loading recap...</p>;

  const plan = trip.plan;
  const activities = plan.days.flatMap((d: any) =>
    d.activities.map((a: any) => ({ ...a, day: d.day }))
  );
  const currentActivity = activities[idx % activities.length];
  const currentPhoto = PLACEHOLDER_PHOTOS[idx % PLACEHOLDER_PHOTOS.length];

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900 p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Phone frame */}
        <div className="bg-black rounded-[3rem] p-3 shadow-2xl">
          <div className="w-full aspect-[9/16] bg-gray-900 rounded-[2.5rem] overflow-hidden relative">

            {/* Photo */}
            {PLACEHOLDER_PHOTOS.map((p, i) => (
              <img
                key={i}
                src={p}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                  i === idx % PLACEHOLDER_PHOTOS.length ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            {/* Top progress bars (like Instagram stories) */}
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
              {PLACEHOLDER_PHOTOS.map((_, i) => (
                <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-white transition-all duration-2500 ${
                      i <= idx ? 'w-full' : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Top left: traveler avatars placeholder */}
            <div className="absolute top-8 left-4 right-4 flex items-center gap-2 z-20 text-white">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-xs font-bold">
                🌏
              </div>
              <div>
                <p className="text-xs font-semibold">{plan.destination}</p>
                <p className="text-[10px] opacity-70">
                  {plan.travelers.length} travelers
                </p>
              </div>
            </div>

            {/* Bottom overlay with activity */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/70 to-transparent text-white z-20">
              <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
                Day {currentActivity?.day}
              </p>
              <h2 className="text-2xl font-bold mb-2 leading-tight">
                {currentActivity?.title}
              </h2>
              <p className="text-sm opacity-90 line-clamp-2">
                {currentActivity?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPlaying(!playing)}
            className="bg-white/20 backdrop-blur text-white px-5 py-2 rounded-full font-medium text-sm hover:bg-white/30"
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => setIdx(0)}
            className="bg-white/20 backdrop-blur text-white px-5 py-2 rounded-full font-medium text-sm hover:bg-white/30"
          >
            🔄 Restart
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied! Share it with your family 📱');
            }}
            className="bg-white text-indigo-900 px-5 py-2 rounded-full font-semibold text-sm hover:bg-white/90"
          >
            Share
          </button>
        </div>

        <p className="text-center text-white/70 text-xs mt-4">
          Your trip story — ready to share 📱
        </p>
      </div>
    </main>
  );
}