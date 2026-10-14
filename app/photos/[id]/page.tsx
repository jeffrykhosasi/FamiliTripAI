'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PhotosPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/photos?tripId=${tripId}`);
    const data = await res.json();
    setPhotos(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tripId]);

  async function remove(id: string) {
    if (!confirm('Delete this photo?')) return;
    await fetch(`/api/photos?id=${id}`, { method: 'DELETE' });
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= photos.length) return;
    const next = [...photos];
    [next[index], next[newIdx]] = [next[newIdx], next[index]];
    next.forEach((p, i) => (p.display_order = i));
    setPhotos(next);
  }

  function updateCaption(id: string, caption: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  }

  async function saveOrder() {
    setSaving(true);
    const updates = photos.map((p, i) => ({
      id: p.id,
      display_order: i,
      caption: p.caption,
    }));
    await fetch('/api/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    setSaving(false);
    alert('Saved!');
  }

  if (loading) return <p className="p-8">Loading photos...</p>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
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
              href={`/recap/${tripId}`}
              className="px-3 py-1.5 rounded-lg text-white font-medium"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              🎬 Album
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold mb-2">Your trip photos</h1>
          <p className="text-gray-600">
            Send photos to your Telegram bot anytime. They'll appear here.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            <strong>{photos.length}</strong> photo{photos.length === 1 ? '' : 's'} collected
          </p>
        </div>

        {photos.length === 0 ? (
          <div
            className="bg-white rounded-2xl shadow-xl p-12 text-center relative overflow-hidden"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(0, 136, 204, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(13, 77, 61, 0.05) 0%, transparent 50%)',
            }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5 text-4xl"
              style={{ backgroundColor: '#e6f4fa' }}
            >
              📸
            </div>
            <h2 className="text-2xl font-bold mb-3">
              Turn your trip into memories
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
              Send photos to your trip concierge on Telegram as you travel. They'll
              gather here — and at the end of your trip, we'll turn them into a
              branded album you can share.
            </p>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-6">
              {['🏯 Photos on the go', '🎨 Auto-arranged album', '📱 Share with family'].map((item) => (
                <div
                  key={item}
                  className="bg-gray-50 rounded-lg p-3 text-xs font-medium text-gray-700"
                >
                  {item}
                </div>
              ))}
            </div>

            <a
              href={`https://t.me/familytrip_ai_bot?start=${tripId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition"
              style={{ backgroundColor: '#0088cc' }}
            >
              💬 Open Telegram & send your first photo
            </a>
            <p className="text-xs text-gray-400 mt-4">
              No app download needed
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden group"
                >
                  <div className="relative aspect-square">
                    <img
                      src={p.url}
                      alt={p.caption || ''}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="bg-black/60 text-white w-7 h-7 rounded-full text-xs disabled:opacity-30"
                        title="Move earlier"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === photos.length - 1}
                        className="bg-black/60 text-white w-7 h-7 rounded-full text-xs disabled:opacity-30"
                        title="Move later"
                      >
                        →
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="bg-red-500 text-white w-7 h-7 rounded-full text-xs"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                    {i === 0 && (
                      <span className="absolute top-2 left-2 text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">
                        COVER
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <input
                      value={p.caption || ''}
                      onChange={(e) => updateCaption(p.id, e.target.value)}
                      placeholder="Add a caption..."
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-green-700"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={saveOrder}
                disabled={saving}
                className="border-2 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                style={{ borderColor: '#0d4d3d', color: '#0d4d3d' }}
              >
                {saving ? 'Saving...' : '💾 Save changes'}
              </button>
              <a
                href={`/recap/${tripId}`}
                className="text-white px-6 py-3 rounded-lg font-semibold"
                style={{ backgroundColor: '#0d4d3d' }}
              >
                🎬 View album
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}