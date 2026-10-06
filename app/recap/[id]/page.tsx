'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
];

export default function RecapPage() {
  const params = useParams();
  const id = params.id as string;

  const [trip, setTrip] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/plan/${id}`).then((r) => r.json()),
      fetch(`/api/photos?tripId=${id}`).then((r) => r.json()),
    ])
      .then(([tripData, photosData]) => {
        if (tripData.error) setError(tripData.error);
        else setTrip(tripData);
        setPhotos(Array.isArray(photosData) ? photosData : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!playing || !trip) return;
    const total = photos.length || PLACEHOLDER_PHOTOS.length;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % total);
    }, 3000);
    return () => clearInterval(t);
  }, [playing, trip, photos]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Loading recap...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <p className="text-4xl mb-4">😔</p>
          <p className="font-bold mb-2">Could not load recap</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <a
            href={`/plan/${id}`}
            className="inline-block border border-gray-300 px-4 py-2 rounded-lg text-sm"
          >
            ← Back to trip
          </a>
        </div>
      </main>
    );
  }

  if (!trip?.plan) return null;

  const plan = trip.plan;
  const days = plan.dailyPlans || plan.days || [];
  const activities = days.flatMap((d: any) =>
    (d.activities || []).map((a: any) => ({ ...a, day: d.day }))
  );

  // Use real photos if available, else placeholders
  const usingRealPhotos = photos.length > 0;
  const photoUrls = usingRealPhotos
    ? photos.map((p) => p.url)
    : PLACEHOLDER_PHOTOS;
  const photoCaptions = usingRealPhotos
    ? photos.map((p) => p.caption || '')
    : [];

  const currentPhoto = photoUrls[idx % photoUrls.length];
  const currentCaption = photoCaptions[idx] || '';
  const currentActivity = activities[idx % Math.max(1, activities.length)] || {};
  const travelers = plan.travelers || [];

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900 p-8 flex items-center justify-center relative">
      <a
        href={`/photos/${id}`}
        className="absolute top-4 left-4 bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full text-sm hover:bg-white/30 z-10"
      >
        ← Back to photos
      </a>

      <div className="w-full max-w-md">
        {/* Phone frame */}
        <div className="bg-black rounded-[3rem] p-3 shadow-2xl relative">
          <div className="w-full aspect-[9/16] bg-gray-900 rounded-[2.5rem] overflow-hidden relative">
            {/* Photos */}
            {photoUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                  i === idx % photoUrls.length ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            {/* Progress bars */}
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
              {photoUrls.map((_, i) => (
                <div
                  key={i}
                  className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className={`h-full bg-white transition-all duration-700 ${
                      i <= idx % photoUrls.length ? 'w-full' : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Header (trip info) */}
            <div className="absolute top-8 left-4 right-4 flex items-center gap-2 z-20 text-white">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-xs font-bold">
                🌏
              </div>
              <div>
                <p className="text-xs font-semibold">
                  {plan.destination || 'Your Trip'}
                </p>
                <p className="text-[10px] opacity-70">
                  {travelers.length} travelers
                </p>
              </div>
            </div>

            {/* WATERMARK LOGO — bottom-right, always visible */}
            <div className="absolute top-4 right-4 z-30 bg-black/40 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
              <span className="text-[10px] font-bold text-white tracking-tight">
                FamilyTrip AI
              </span>
              <span className="text-[10px]">🌏</span>
            </div>

            {/* Bottom overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/70 to-transparent text-white z-20">
              <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
                Day {currentActivity.day || 1}
              </p>
              <h2 className="text-2xl font-bold mb-2 leading-tight">
                {currentCaption || currentActivity.title || 'A moment to remember'}
              </h2>
              <p className="text-sm opacity-90 line-clamp-2">
                {currentCaption ? currentActivity.title : currentActivity.description || ''}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPlaying(!playing)}
            className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-white/30"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => setIdx(0)}
            className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-white/30"
          >
            🔄
          </button>
          <button
            onClick={async () => {
              // Copy link
              try {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied! Share it with your family 📱');
              } catch {
                alert('Could not copy. You can copy the URL manually.');
              }
            }}
            className="bg-white text-indigo-900 px-6 py-2 rounded-full font-semibold text-sm hover:bg-white/90"
          >
            🔗 Share link
          </button>
        </div>

        <p className="text-center text-white/70 text-xs mt-4">
          {usingRealPhotos
            ? `${photos.length} photo${photos.length === 1 ? '' : 's'} from your trip`
            : 'Demo photos — upload real ones via Telegram'}
        </p>
      </div>
    </main>
  );
}