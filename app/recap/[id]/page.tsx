'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
  'https://images.unsplash.com/photo-1533050487297-09b450131914?w=800&q=80',
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
  'https://images.unsplash.com/photo-1554797589-7241bb691973?w=800&q=80',
];

export default function RecapPage() {
  const params = useParams();
  const id = params.id as string;

  const [trip, setTrip] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);

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

  // Rotate the "highlighted" photo every few seconds
  useEffect(() => {
    if (!playing || !trip) return;
    const t = setInterval(() => {
      setTick((i) => i + 1);
    }, 3000);
    return () => clearInterval(t);
  }, [playing, trip]);

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
          <a href={`/plan/${id}`} className="inline-block border border-gray-300 px-4 py-2 rounded-lg text-sm">
            ← Back to trip
          </a>
        </div>
      </main>
    );
  }

  if (!trip?.plan) return null;

  const plan = trip.plan;
  const travelers = plan.travelers || [];
  const destination = plan.destination || 'Your Trip';
  const cityName = destination.split(',')[0].trim();
  const days = plan.dailyPlans || plan.days || [];

  // Use uploaded photos or placeholders
  const usingRealPhotos = photos.length > 0;
  const photoUrls = usingRealPhotos ? photos.map((p) => p.url) : PLACEHOLDER_PHOTOS;

  // Split into 6 "album slots" — the photos we show in the collage
  const slots = photoUrls.slice(0, 6);
  while (slots.length < 6) {
    slots.push(photoUrls[slots.length % photoUrls.length]);
  }

  // Which slot is highlighted (cycles every 3s)
  const highlightedSlot = tick % 6;

  return (
    <main
      className="min-h-screen p-6 flex items-center justify-center relative py-10"
      style={{
        background: 'linear-gradient(135deg, #2a1810 0%, #1a1a1a 100%)',
      }}
    >
      <a
        href={`/photos/${id}`}
        className="absolute top-4 left-4 bg-white/10 backdrop-blur text-white px-4 py-2 rounded-full text-sm hover:bg-white/20 z-20"
      >
        ← Back
      </a>

      <div className="w-full max-w-4xl">
        {/* The album page */}
        <div className="relative">
          {/* Washi tape corners */}
          <div
            className="absolute -top-3 -left-3 w-24 h-8 z-30"
            style={{
              background: 'repeating-linear-gradient(45deg, #0d4d3d, #0d4d3d 6px, #1a6b54 6px, #1a6b54 12px)',
              transform: 'rotate(-12deg)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          />
          <div
            className="absolute -top-3 -right-3 w-24 h-8 z-30"
            style={{
              background: 'repeating-linear-gradient(45deg, #d4a574, #d4a574 6px, #e6c896 6px, #e6c896 12px)',
              transform: 'rotate(12deg)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          />

          {/* The album itself */}
          <div
            className="rounded-2xl p-8 shadow-2xl relative overflow-hidden"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(212, 165, 116, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(13, 77, 61, 0.05) 0%, transparent 50%)',
              backgroundColor: '#fdfbf5',
            }}
          >
            {/* Paper texture */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.015) 2px, rgba(0,0,0,0.015) 3px)',
              }}
            />

            {/* Header */}
            <div className="relative z-10 flex justify-between items-start mb-6">
              <div>
                <p
                  className="text-4xl font-bold mb-1"
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    color: '#2a1810',
                    letterSpacing: '-0.02em',
                  }}
                >
                  My {cityName}
                </p>
                <p
                  className="text-5xl italic"
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    color: '#0d4d3d',
                    letterSpacing: '-0.02em',
                  }}
                >
                  adventure
                </p>
              </div>

              {/* Brand stamp */}
              <div
                className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg text-white"
                style={{
                  backgroundColor: '#0d4d3d',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  transform: 'rotate(3deg)',
                  border: '2px solid #fdfbf5',
                }}
              >
                <p className="text-[9px] uppercase tracking-[0.2em] opacity-80">Created by</p>
                <p className="text-xs font-bold tracking-wider">FamilyTrip AI</p>
                <div className="w-6 h-0.5 bg-white/40 mt-0.5" />
                <p className="text-[8px] tracking-wider opacity-70">{plan.days} DAYS</p>
              </div>
            </div>

            {/* Trip meta strip */}
            <div className="relative z-10 flex items-center gap-4 mb-6 pb-4 border-b border-dashed" style={{ borderColor: '#d4a574' }}>
              <div>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: '#8a6a4a' }}>Destination</p>
                <p className="text-xs font-semibold" style={{ color: '#2a1810' }}>{destination}</p>
              </div>
              <div className="w-px h-6" style={{ backgroundColor: '#d4a574' }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: '#8a6a4a' }}>Travelers</p>
                <p className="text-xs font-semibold" style={{ color: '#2a1810' }}>{travelers.length}</p>
              </div>
              <div className="w-px h-6" style={{ backgroundColor: '#d4a574' }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: '#8a6a4a' }}>Duration</p>
                <p className="text-xs font-semibold" style={{ color: '#2a1810' }}>{plan.days} days</p>
              </div>
            </div>

            {/* Photo collage — 6 photos in a magazine grid */}
            <div className="relative z-10 grid grid-cols-3 gap-3">
              {/* Photo 1 — large (spans 2 cols, 2 rows) */}
              <div className={`col-span-2 row-span-2 relative transition-all duration-700 ${highlightedSlot === 0 ? 'ring-4 ring-offset-4' : ''}`}
                style={{ borderRadius: '4px', ...(highlightedSlot === 0 ? { ringColor: '#0d4d3d', ringOffsetColor: '#fdfbf5' } : {}) }}>
                <PolaroidPhoto
                  src={slots[0]}
                  rotation={-1.5}
                  highlighted={highlightedSlot === 0}
                  washiTape="green"
                />
              </div>

              {/* Photo 2 — tall right */}
              <div className="row-span-2">
                <PolaroidPhoto
                  src={slots[1]}
                  rotation={2}
                  highlighted={highlightedSlot === 1}
                  washiTape="gold"
                />
              </div>

              {/* Photo 3 — small */}
              <div>
                <PolaroidPhoto
                  src={slots[2]}
                  rotation={-2}
                  highlighted={highlightedSlot === 2}
                  washiTape="gold"
                />
              </div>

              {/* Photo 4 — small */}
              <div>
                <PolaroidPhoto
                  src={slots[3]}
                  rotation={1.5}
                  highlighted={highlightedSlot === 3}
                  washiTape="green"
                />
              </div>
            </div>

            {/* Bottom row: 2 more photos + stats card */}
            <div className="relative z-10 grid grid-cols-3 gap-3 mt-3">
              <div>
                <PolaroidPhoto
                  src={slots[4]}
                  rotation={-1}
                  highlighted={highlightedSlot === 4}
                  washiTape="green"
                />
              </div>
              <div>
                <PolaroidPhoto
                  src={slots[5]}
                  rotation={2.5}
                  highlighted={highlightedSlot === 5}
                  washiTape="gold"
                />
              </div>

              {/* Stats / brand card */}
              <div
                className="rounded-lg p-4 flex flex-col justify-between"
                style={{
                  backgroundColor: 'rgba(212, 165, 116, 0.12)',
                  border: '1px dashed #d4a574',
                  transform: 'rotate(-1deg)',
                }}
              >
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#8a6a4a' }}>Memories</p>
                  <p className="text-2xl font-bold" style={{ color: '#0d4d3d', fontFamily: 'Georgia, serif' }}>
                    {photoUrls.length}
                  </p>
                  <p className="text-[10px]" style={{ color: '#8a6a4a' }}>photos captured</p>
                </div>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#d4a574' }}>
                  <p className="text-[9px] italic" style={{ color: '#8a6a4a', fontFamily: 'Georgia, serif' }}>
                    ~ made with FamilyTrip AI ~
                  </p>
                </div>
              </div>
            </div>

            {/* ─── THE MEMORIES PANEL ─── */}
            <div className="relative z-10 mt-8 pt-6 border-t border-dashed" style={{ borderColor: '#d4a574' }}>
              
              {/* Header script */}
              <p
                className="text-center text-sm italic mb-5"
                style={{
                  fontFamily: 'Georgia, serif',
                  color: '#8a6a4a',
                }}
              >
                ~ looking back on ~
              </p>

              {/* Trip title */}
              <p
                className="text-center text-3xl font-bold mb-6"
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  color: '#2a1810',
                }}
              >
                {plan.days} days in {cityName}
              </p>

              {/* Info grid — dates, travelers, budget */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#8a6a4a' }}>Dates</p>
                  <p className="text-xs font-semibold" style={{ color: '#2a1810' }}>
                    {plan.startDate && plan.returnDate ? (
                      <>
                        {new Date(plan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(plan.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </>
                    ) : '—'}
                  </p>
                </div>
                <div className="text-center border-x" style={{ borderColor: '#d4a574' }}>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#8a6a4a' }}>Travelers</p>
                  <p className="text-xs font-semibold" style={{ color: '#2a1810' }}>{travelers.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#8a6a4a' }}>Activities</p>
                  <p className="text-xs font-semibold" style={{ color: '#2a1810' }}>{days.reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0)}</p>
                </div>
              </div>

              {/* Travelers list */}
              {travelers.length > 0 && (
                <div className="mb-6 text-center">
                  <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: '#8a6a4a' }}>
                    Traveling with
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {travelers.map((t: any, i: number) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: 'rgba(13, 77, 61, 0.1)',
                          color: '#0d4d3d',
                          border: '1px solid rgba(13, 77, 61, 0.2)',
                        }}
                      >
                        {t.role === 'kid' && '👶 '}
                        {t.role === 'elderly' && '👴 '}
                        {t.role === 'adult' && '👤 '}
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-by-day simplified itinerary */}
              <div className="mb-6">
                <p
                  className="text-center text-lg italic mb-4"
                  style={{
                    fontFamily: 'Georgia, serif',
                    color: '#0d4d3d',
                  }}
                >
                  Your journey
                </p>

                <div className="space-y-3">
                  {days.map((d: any, i: number) => {
                    // Simplify: just show the theme or the first activity
                    const theme = d.theme || d.activities?.[0]?.title || 'Free day';
                    const highlights = (d.activities || [])
                      .slice(0, 3)
                      .map((a: any) => a.title?.split('—')[0]?.trim())
                      .filter(Boolean);

                    return (
                      <div
                        key={i}
                        className="flex gap-4 items-start py-2 px-3 rounded-lg"
                        style={{
                          backgroundColor: i % 2 === 0 ? 'rgba(212, 165, 116, 0.08)' : 'transparent',
                        }}
                      >
                        {/* Day badge */}
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-full flex flex-col items-center justify-center text-white"
                          style={{
                            backgroundColor: '#0d4d3d',
                          }}
                        >
                          <p className="text-[7px] uppercase leading-none">Day</p>
                          <p className="text-sm font-bold leading-none">{d.day}</p>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold mb-0.5" style={{ color: '#2a1810' }}>
                            {theme}
                          </p>
                          {highlights.length > 0 && (
                            <p className="text-[10px] leading-relaxed" style={{ color: '#8a6a4a' }}>
                              {highlights.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Closing note */}
              <div className="text-center pt-4 border-t border-dashed" style={{ borderColor: '#d4a574' }}>
                <p
                  className="text-xs italic mb-3"
                  style={{
                    fontFamily: 'Georgia, serif',
                    color: '#8a6a4a',
                  }}
                >
                  ~ until the next adventure ~
                </p>
                <p className="text-[10px] tracking-wider uppercase" style={{ color: '#0d4d3d' }}>
                  FamilyTrip AI
                </p>
              </div>
            </div>

            {/* Footer ribbon */}
            <div className="relative z-10 mt-6 text-center">
              <div className="inline-block px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest" style={{ backgroundColor: '#0d4d3d', color: '#fdfbf5' }}>
                ✦ {cityName} · {plan.startDate} → {plan.returnDate} ✦
              </div>
            </div>

            {/* Decorative stamps scattered */}
            <div
              className="absolute top-40 left-8 w-16 h-16 rounded-full flex items-center justify-center opacity-30"
              style={{
                border: '2px dashed #0d4d3d',
                transform: 'rotate(-15deg)',
              }}
            >
              <p className="text-[7px] text-center font-bold" style={{ color: '#0d4d3d' }}>
                {cityName.toUpperCase().slice(0, 8)}<br />{new Date().getFullYear()}
              </p>
            </div>

            <div
              className="absolute bottom-32 right-12 w-14 h-14 rounded-full flex items-center justify-center opacity-25"
              style={{
                border: '2px solid #d4a574',
                transform: 'rotate(20deg)',
              }}
            >
              <p className="text-[6px] text-center font-bold" style={{ color: '#8a6a4a' }}>
                FAMILY<br />TRIP<br />AI
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPlaying(!playing)}
            className="bg-white/10 backdrop-blur text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-white/20"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => setTick(0)}
            className="bg-white/10 backdrop-blur text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-white/20"
          >
            🔄
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied! Share it with your family 📱');
              } catch {
                alert('Could not copy. You can copy the URL manually.');
              }
            }}
            className="bg-white text-gray-900 px-6 py-2 rounded-full font-semibold text-sm hover:bg-gray-100"
          >
            🔗 Share
          </button>
        </div>

        <p className="text-center text-white/50 text-xs mt-4">
          {usingRealPhotos
            ? `${photos.length} photo${photos.length === 1 ? '' : 's'} · send more via Telegram`
            : 'Demo photos — send real ones via Telegram to see them here'}
        </p>
      </div>
    </main>
  );
}

// ─── Polaroid-style photo component ───
function PolaroidPhoto({
  src,
  rotation = 0,
  highlighted = false,
  washiTape = 'green',
}: {
  src: string;
  rotation?: number;
  highlighted?: boolean;
  washiTape?: 'green' | 'gold';
}) {
  const tapeColor = washiTape === 'green'
    ? 'repeating-linear-gradient(45deg, #0d4d3d, #0d4d3d 5px, #1a6b54 5px, #1a6b54 10px)'
    : 'repeating-linear-gradient(45deg, #d4a574, #d4a574 5px, #e6c896 5px, #e6c896 10px)';

  return (
    <div
      className="relative transition-all duration-500"
      style={{
        transform: `rotate(${rotation}deg) scale(${highlighted ? 1.03 : 1})`,
        filter: highlighted
          ? 'drop-shadow(0 12px 20px rgba(0,0,0,0.25))'
          : 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))',
      }}
    >
      {/* Washi tape at top */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 z-10"
        style={{
          background: tapeColor,
          transform: 'translateX(-50%) rotate(-3deg)',
          opacity: 0.9,
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
      {/* White polaroid border */}
      <div
        className="bg-white p-2 pb-6 rounded-sm"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
        }}
      >
        <div className="aspect-square overflow-hidden bg-gray-100">
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}