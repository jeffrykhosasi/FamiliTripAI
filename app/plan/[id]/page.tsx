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
  const [activeActivity, setActiveActivity] = useState<{ di: number; ai: number } | null>(null);
  const [removingCar, setRemovingCar] = useState(false);
  const [addingCar, setAddingCar] = useState(false);

  // Undo + add activity state
  const [deletedStack, setDeletedStack] = useState<
    Array<{ di: number; ai: number; activity: any; dayNumber: number }>
  >([]);
  const [showUndo, setShowUndo] = useState(false);
  const [addingActivityToDay, setAddingActivityToDay] = useState<number | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [selectedCabin, setSelectedCabin] = useState<'economy' | 'premium' | 'business'>('economy');
  const [newActivity, setNewActivity] = useState({
    time: '10:00',
    title: '',
    description: '',
  });

  useEffect(() => {
    fetch(`/api/plan/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          if (data.status === 'booked') {
            window.location.href = `/book/${id}`;
            return;
          }
          setTrip(data);
          setPlan(data.plan);
        }
        setLoading(false);
      });
  }, [id]);

  const hasCar = plan?.rentalCar?.recommended === true;

  function updateActivity(di: number, ai: number, field: string, value: any) {
    const next = structuredClone(plan);
    next.dailyPlans[di].activities[ai][field] = value;
    setPlan(next);
    setSaved(false);
  }

  function removeActivity(di: number, ai: number) {
    const activity = plan.dailyPlans[di].activities[ai];
    const dayNumber = plan.dailyPlans[di].day;

    // Add to the persistent library
    const next = structuredClone(plan);
    if (!next.removedActivities) next.removedActivities = [];
    next.removedActivities.push({
      activity: structuredClone(activity),
      dayNumber,
      removedAt: new Date().toISOString(),
    });

    // Remove from the day
    next.dailyPlans[di].activities.splice(ai, 1);

    // Still track for instant undo
    setDeletedStack((prev) => [
      ...prev,
      { di, ai, activity: structuredClone(activity), dayNumber },
    ]);
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);

    setPlan(next);
    setSaved(false);
    setActiveActivity(null);
  }

  function undoLastDelete() {
    if (deletedStack.length === 0) return;
    const last = deletedStack[deletedStack.length - 1];
    const next = structuredClone(plan);
    const day = next.dailyPlans.find((d: any) => d.day === last.dayNumber);
    if (day) {
      const idx = Math.min(last.ai, day.activities.length);
      day.activities.splice(idx, 0, last.activity);
      // Remove from library
      if (next.removedActivities) {
        const idx2 = next.removedActivities.findIndex(
          (ra: any) =>
            ra.activity.title === last.activity.title &&
            ra.dayNumber === last.dayNumber
        );
        if (idx2 >= 0) next.removedActivities.splice(idx2, 1);
      }
      setPlan(next);
      setSaved(false);
    }
    setDeletedStack((prev) => prev.slice(0, -1));
    setShowUndo(false);
  }

    function restoreActivity(libraryIndex: number, targetDay: number) {
    const next = structuredClone(plan);
    if (!next.removedActivities || !next.removedActivities[libraryIndex]) return;

    const removed = next.removedActivities[libraryIndex];
    const day = next.dailyPlans.find((d: any) => d.day === targetDay);
    if (!day) return;

    // Auto-generate a time slot for the restored activity
    const timeSlot = generateTimeSlot(day);
    const restoredActivity = {
      ...removed.activity,
      time: removed.activity.time || timeSlot,
    };

    day.activities.push(restoredActivity);
    day.activities.sort((a: any, b: any) =>
      (a.time || '').localeCompare(b.time || '')
    );

    // Remove from library
    next.removedActivities.splice(libraryIndex, 1);

    setPlan(next);
    setSaved(false);
  }

  function generateTimeSlot(day: any): string {
    const activities = day.activities || [];
    if (activities.length === 0) return '10:00';

    // Find the latest activity time and add 2 hours
    const lastTime = activities[activities.length - 1].time || '10:00';
    const match = lastTime.match(/(\d{1,2}):(\d{2})/);
    if (!match) return '10:00';

    let hours = parseInt(match[1]) + 2;
    const minutes = parseInt(match[2]);

    // Cap at 20:00
    if (hours > 20) hours = 20;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function startAddActivity(dayNumber: number) {
    setAddingActivityToDay(dayNumber);
    setNewActivity({ time: '10:00', title: '', description: '' });
  }

  function confirmAddActivity() {
    if (!newActivity.title.trim() || addingActivityToDay === null) return;
    const next = structuredClone(plan);
    const day = next.dailyPlans.find((d: any) => d.day === addingActivityToDay);
    if (!day) return;
    const autoTime = newActivity.time && newActivity.time !== '10:00' 
      ? newActivity.time 
      : generateTimeSlot(day);

    day.activities.push({
      time: autoTime,
      title: newActivity.title.trim(),
      description: newActivity.description.trim() || '',
      cost_usd: 0,
      transport: {
        recommended: hasCar ? 'car' : 'public',
        car: {
          available: hasCar,
          duration: '15 min',
          distance: '5 km',
          cost: 5,
          details: 'Drive to the activity and park nearby.',
        },
        public: {
          available: true,
          duration: '25 min',
          cost: 3,
          details: 'Take public transport to the activity.',
        },
      },
      next: '',
      kidFriendly: true,
      elderlyFriendly: true,
    });

    day.activities.sort((a: any, b: any) =>
      (a.time || '').localeCompare(b.time || '')
    );

    setPlan(next);
    setSaved(false);
    setAddingActivityToDay(null);
    setNewActivity({ time: '10:00', title: '', description: '' });
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const res = await fetch(`/api/plan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert('Could not save: ' + e.message);
    }
    setSaving(false);
  }

  async function removeRentalCar() {
    if (!confirm('Remove the rental car and switch to public transport?')) return;
    setRemovingCar(true);
    try {
      const res = await fetch(`/api/plan/${id}/remove-car`, { method: 'POST' });
      const data = await res.json();
      if (data.error) alert('AI busy, try again in a moment');
      else {
        setPlan(data.plan);
        setSaved(false);
      }
    } catch {
      alert('Something went wrong');
    }
    setRemovingCar(false);
  }

  async function addRentalCar() {
    if (!confirm('Add a rental car for the whole trip?')) return;
    setAddingCar(true);
    try {
      const res = await fetch(`/api/plan/${id}/add-car`, { method: 'POST' });
      const data = await res.json();
      if (data.error) alert('AI busy, try again in a moment');
      else {
        setPlan(data.plan);
        setSaved(false);
      }
    } catch {
      alert('Something went wrong');
    }
    setAddingCar(false);
  }

  function confirmAndBook() {
    window.location.href = `/book/${id}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Hero skeleton */}
          <div className="bg-white rounded-2xl shadow-sm p-8 mb-6 animate-pulse" style={{ borderLeft: '4px solid #e5e7eb' }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="h-8 w-48 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-64 bg-gray-200 rounded" />
              </div>
              <div className="text-right">
                <div className="h-3 w-16 bg-gray-200 rounded mb-2 ml-auto" />
                <div className="h-8 w-24 bg-gray-200 rounded ml-auto" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                  <div className="h-6 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
              <div className="h-3 bg-gray-200 rounded-full w-full" />
            </div>
          </div>

          {/* Days skeleton */}
          {[1, 2, 3].map((dayNum) => (
            <div
              key={dayNum}
              className="bg-white rounded-2xl shadow-sm p-6 mb-4 animate-pulse"
              style={{ animationDelay: `${dayNum * 100}ms` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-20 bg-gray-200 rounded-lg" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>

              {[1, 2].map((act) => (
                <div key={act} className="border border-gray-200 rounded-xl mb-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-4 w-14 bg-gray-200 rounded" />
                    <div className="flex-1">
                      <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                      <div className="h-3 w-full bg-gray-200 rounded mb-1" />
                      <div className="h-3 w-3/4 bg-gray-200 rounded" />
                    </div>
                    <div className="h-5 w-12 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </main>
      </div>
    );
  }
  if (error) return <p className="p-8 text-red-600">Error: {error}</p>;
  if (!plan) return null;

  const breakdown = plan.budgetBreakdown || {};
  const budget = trip?.budget_usd || 0;
  const car = plan.rentalCar;

  // Flight cost calculation
  const flight = plan.flight || {};
  const cabinMultiplier =
    flight.cabinOptions?.[selectedCabin]?.multiplier ||
    (selectedCabin === 'economy' ? 1 : selectedCabin === 'premium' ? 1.8 : 3.5);
  const adultCount = plan.travelers?.filter((t: any) => t.role === 'adult').length || 1;
  const kidCount = plan.travelers?.filter((t: any) => t.role === 'kid').length || 0;
  const seniorCount = plan.travelers?.filter((t: any) => t.role === 'elderly').length || 0;
  const basePricePerAdult = flight.basePricePerAdult || 1200;
  const basePricePerChild = flight.basePricePerChild || 900;

  const flightTotal = Math.round(
    ((adultCount + seniorCount) * basePricePerAdult + kidCount * basePricePerChild) *
      cabinMultiplier
  );
  const milesEarned = Math.floor(flightTotal / 15);

  const activitiesSpent = (plan.dailyPlans || []).reduce(
    (sum: number, day: any) =>
      sum +
      (day.activities || []).reduce(
        (daySum: number, a: any) => daySum + (a.cost_usd || 0),
        0
      ),
    0
  );

  const rentalCarTotal = plan.rentalCar?.recommended ? plan.rentalCar.totalPrice || 0 : 0;
  const accommodation = plan.budgetBreakdown?.accommodation || 0;

  // Flight cost only counts if user opted in (default: yes for OTA)
  const includeFlight = plan.flight?.included !== false;
  const effectiveFlightCost = includeFlight ? flightTotal : 0;

  const totalSpent = activitiesSpent + rentalCarTotal + accommodation + effectiveFlightCost;
  const remaining = budget - totalSpent;
  const spentPercent = budget > 0 ? Math.min(100, (totalSpent / budget) * 100) : 0;
  const isOverBudget = totalSpent > budget;
  const totalMilesEarned = Math.floor(totalSpent / 15);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/" className="text-xl font-bold" style={{ color: '#0d4d3d' }}>
              FamilyTrip
            </a>
            <div className="hidden md:flex gap-6 text-sm font-medium text-gray-700">
              <a href="/" className="hover:text-gray-900">Plan new trip</a>
              <a href="/trips" className="hover:text-gray-900">My trips</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:inline">
              {plan.destination} · {plan.days} days
            </span>
            <a
              href="/trips"
              className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
            >
              🗂 My trips
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero card */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-6" style={{ borderLeft: '4px solid #0d4d3d' }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-1">{plan.destination}</h1>
              <p className="text-gray-500 text-sm">
                {plan.startDate} → {plan.returnDate} · {plan.days} days
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Budget</p>
              <p className="text-2xl font-bold">${budget.toLocaleString('en-US')}</p>
            </div>
          </div>

          {/* Budget tracker */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Budget tracker
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold" style={{ color: isOverBudget ? '#dc2626' : '#0d4d3d' }}>
                    ${totalSpent.toLocaleString('en-US')}
                  </span>
                  {' '}spent of ${budget.toLocaleString('en-US')}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  ✈️ Flights ${effectiveFlightCost.toLocaleString('en-US')} · 🏨 Hotels ${accommodation.toLocaleString('en-US')} · 🚗 Car ${rentalCarTotal.toLocaleString('en-US')} · 🎫 Activities ${activitiesSpent.toLocaleString('en-US')}
                </p>                
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  {isOverBudget ? 'Over budget by' : 'Remaining'}
                </p>
                <p
                  className="text-lg font-bold"
                  style={{ color: isOverBudget ? '#dc2626' : '#0d4d3d' }}
                >
                  ${Math.abs(remaining).toLocaleString('en-US')}
                </p>
                <p className="text-xs font-medium text-amber-700 mt-0.5">
                  ✨ {totalMilesEarned.toLocaleString('en-US')} miles
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${spentPercent}%`,
                  backgroundColor: isOverBudget ? '#dc2626' : '#0d4d3d',
                }}
              />
            </div>

            {isOverBudget && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                ⚠️ You're ${Math.abs(remaining).toLocaleString('en-US')} over budget. Remove or reduce some activities.
              </p>
            )}
          </div>          

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Accommodation', value: breakdown.accommodation, icon: '🏨' },
              { label: 'Food', value: breakdown.food, icon: '🍽️' },
              { label: 'Transport', value: breakdown.transport, icon: '🚇' },
              { label: 'Activities', value: breakdown.activities, icon: '🎫' },
            ].map((b) => (
              <div key={b.label} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>{b.icon}</span>
                  <span className="text-xs text-gray-500">{b.label}</span>
                </div>
                <p className="font-semibold">${(b.value || 0).toLocaleString('en-US')}</p>
              </div>
            ))}
          </div>

          {plan.transportPlan && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {car?.recommended ? (
                  <>
                    <span className="text-lg">🚗</span>
                    <span className="font-semibold text-sm">This trip uses a rental car</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">🚇</span>
                    <span className="font-semibold text-sm">This trip uses public transport</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">{plan.transportPlan}</p>
            </div>
          )}
        </div>

        {/* Flight card */}
        {plan.flight && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6" style={{ borderLeft: '4px solid #0d4d3d' }}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: '#0d4d3d' }}
                >
                  ✈️
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0d4d3d' }}>
                    {plan.flight.airline || 'Flight'}
                  </p>
                  <p className="font-bold text-lg">
                    {plan.flight.flightNumber || 'CX'} · {plan.flight.route || `${plan.destination} route`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Round-trip · {plan.travelers?.length || 1} travelers</p>
                <p className="text-2xl font-bold" style={{ color: '#0d4d3d' }}>
                  ${flightTotal.toLocaleString('en-US')}
                </p>
                <p className="text-xs font-medium text-amber-700 mt-0.5">
                  ✨ Earn {milesEarned.toLocaleString('en-US')} miles
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Departure</p>
                <p className="font-semibold">{plan.flight.departureTime || '08:30'}</p>
              </div>
              <div className="border-x border-gray-200 px-3">
                <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                <p className="font-semibold">{plan.flight.duration || '7h 15m'}</p>
              </div>
              <div className="pl-3">
                <p className="text-xs text-gray-500 mb-0.5">Arrival</p>
                <p className="font-semibold">{plan.flight.arrivalTime || '16:45'}</p>
              </div>
            </div>

            {/* Cabin selector */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Choose your cabin
                </p>
                {isOverBudget && selectedCabin !== 'economy' && (
                  <p className="text-xs text-red-600 font-medium">
                    ⚠️ Over budget with this cabin
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'economy', label: 'Economy', mult: 1, perks: 'Standard seat · 30kg luggage' },
                  { key: 'premium', label: 'Premium Economy', mult: 1.8, perks: 'Extra legroom · Priority boarding' },
                  { key: 'business', label: 'Business', mult: 3.5, perks: 'Lie-flat bed · Lounge access' },
                ].map((cabin) => {
                  const cabinPrice = Math.round(flightTotal / cabinMultiplier * cabin.mult);
                  const cabinMiles = Math.floor(cabinPrice / 15);
                  const isSelected = selectedCabin === cabin.key;
                  return (
                    <button
                      key={cabin.key}
                      onClick={() => setSelectedCabin(cabin.key as any)}
                      className={`text-left rounded-lg p-3 border-2 transition ${
                        isSelected
                          ? 'border-green-700 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-green-400'
                      }`}
                    >
                      <p className="text-xs font-bold mb-1">{cabin.label}</p>
                      <p className="text-sm font-semibold mb-0.5">
                        ${cabinPrice.toLocaleString('en-US')}
                      </p>
                      <p className="text-[10px] text-amber-700 font-medium mb-1">
                        ✨ {cabinMiles} miles
                      </p>
                      <p className="text-[10px] text-gray-500 leading-tight">{cabin.perks}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Rental car card */}
        {car && car.recommended ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6" style={{ borderLeft: '4px solid #0d4d3d' }}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold text-green-800 mb-1">🚗 RENTAL CAR</p>
                <h2 className="text-xl font-bold">{car.type}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total ({car.days} days)</p>
                <p className="text-2xl font-bold">${car.totalPrice}</p>
                <p className="text-xs text-gray-500">${car.dailyPrice}/day</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Pickup</p>
                <p>{car.pickupLocation}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Drop-off</p>
                <p>{car.dropoffLocation}</p>
              </div>
            </div>
            {car.note && <p className="text-sm text-gray-600 italic mb-4">💡 {car.note}</p>}
            <button
              onClick={removeRentalCar}
              disabled={removingCar}
              className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
            >
              {removingCar ? '🔄 Finding public transport alternatives...' : '✕ Remove rental car & use public transport instead'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">🚇 PUBLIC TRANSPORT</p>
              <p className="text-sm text-gray-600">
                Your trip is planned with public transport. Want to switch to a rental car?
              </p>
            </div>
            <button
              onClick={addRentalCar}
              disabled={addingCar}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50 whitespace-nowrap ml-4"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              {addingCar ? '🔄 Adding...' : '+ Add rental car'}
            </button>
          </div>
        )}

        {/* Days */}
        {plan.dailyPlans?.map((day: any, di: number) => (
          <div key={di} className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-white text-sm font-bold rounded-lg px-3 py-1.5"
                style={{ backgroundColor: '#0d4d3d' }}
              >
                Day {day.day}
              </span>
              <span className="text-gray-500 text-sm">{day.date}</span>
              {day.theme && <span className="text-sm font-medium text-gray-700">— {day.theme}</span>}
            </div>

            {day.activities?.map((a: any, ai: number) => {
              const t = a.transport;
              const isRental = a.isRentalCarEvent;
              const isParentsDayOff = a.isParentsDayOffEvent;

              return (
                <button
                  key={ai}
                  onClick={() => setActiveActivity({ di, ai })}
                  className={`w-full text-left rounded-xl mb-3 p-4 hover:shadow-md transition ${
                    isRental
                      ? 'border-2 border-green-700 bg-green-50'
                      : isParentsDayOff
                      ? 'border-2 border-yellow-500 bg-yellow-50'
                      : 'border border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-mono text-gray-500 pt-0.5 w-14">
                      {a.time}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {isRental && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-800 bg-green-200 px-1.5 py-0.5 rounded">
                            🚗 Rental Car
                          </span>
                        )}
                        {isParentsDayOff && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-800 bg-yellow-200 px-1.5 py-0.5 rounded">
                            ✨ Parents' Day Off
                          </span>
                        )}
                        <p className="font-semibold text-gray-900">{a.title}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-1">
                        {a.kidFriendly && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            👶 Kid
                          </span>
                        )}
                        {a.elderlyFriendly && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            👴 Senior
                          </span>
                        )}
                        {t?.car?.available && (
                          <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            🚗 {t.car.duration} · ${t.car.cost}
                          </span>
                        )}
                        {t?.public?.available && (
                          <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            🚇 {t.public.duration} · ${t.public.cost}
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">{a.description}</p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-sm font-semibold">${a.cost_usd || 0}</p>
                      <p className="text-gray-400 text-xs">View →</p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Add activity button/form */}
            {addingActivityToDay === day.day ? (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-300">
                <p className="font-semibold text-sm mb-3">Add activity to Day {day.day}</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Activity title (e.g. Visit Senso-ji Temple)"
                    value={newActivity.title}
                    onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <input
                    type="time"
                    value={newActivity.time}
                    onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={newActivity.description}
                    onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={confirmAddActivity}
                      disabled={!newActivity.title.trim()}
                      className="flex-1 text-white py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                      style={{ backgroundColor: '#0d4d3d' }}
                    >
                      Add activity
                    </button>
                    <button
                      onClick={() => setAddingActivityToDay(null)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => startAddActivity(day.day)}
                className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-green-700 hover:text-green-800 hover:bg-green-50 transition"
              >
                + Add activity to Day {day.day}
              </button>
            )}
          </div>
        ))}

        {/* Activity Library */}
        {(plan.removedActivities || []).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4 border-l-4" style={{ borderColor: '#d4a574' }}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-bold text-lg">📚 Activity Library</h2>
                <p className="text-sm text-gray-500">
                  {(plan.removedActivities || []).length} removed activities — click to restore
                </p>
              </div>
              <button
                onClick={() => setShowLibrary(!showLibrary)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                {showLibrary ? '▼ Hide' : '▲ Show'}
              </button>
            </div>

            {showLibrary && (
              <div className="grid md:grid-cols-2 gap-3">
                {(plan.removedActivities || []).map((ra: any, i: number) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-lg p-3 hover:border-green-700 transition"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{ra.activity.title}</p>
                        <p className="text-xs text-gray-500">
                          Originally Day {ra.dayNumber} · {ra.activity.time}
                        </p>
                        {ra.activity.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                            {ra.activity.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                        ${ra.activity.cost_usd || 0}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        id={`restore-day-${i}`}
                        className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-green-700"
                        defaultValue={ra.dayNumber}
                      >
                        {(plan.dailyPlans || []).map((d: any) => (
                          <option key={d.day} value={d.day}>
                            Day {d.day}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const select = document.getElementById(
                            `restore-day-${i}`
                          ) as HTMLSelectElement;
                          restoreActivity(i, parseInt(select.value));
                        }}
                        className="text-xs font-medium px-3 py-1 rounded text-white"
                        style={{ backgroundColor: '#0d4d3d' }}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Undo toast */}
        {showUndo && deletedStack.length > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
            <span className="text-sm">Activity removed</span>
            <button
              onClick={undoLastDelete}
              className="text-sm font-semibold underline hover:no-underline"
              style={{ color: '#7ce4b8' }}
            >
              Undo
            </button>
          </div>
        )}

        {/* Sticky action bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 sticky bottom-4">
          <a
            href="/trips"
            className="px-4 py-3 rounded-lg border border-gray-300 font-semibold text-sm hover:bg-gray-50 whitespace-nowrap"
          >
            🗂 My trips
          </a>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="flex-1 border-2 py-3 rounded-lg font-semibold disabled:opacity-50"
            style={{ borderColor: '#0d4d3d', color: '#0d4d3d' }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
          </button>
          <button
            onClick={confirmAndBook}
            className="flex-1 text-white py-3 rounded-lg font-semibold"
            style={{ backgroundColor: '#0d4d3d' }}
          >
            ✅ Confirm & book
          </button>
        </div>
      </main>

      {/* Activity Modal */}
      {activeActivity && (
        <ActivityModal
          activity={plan.dailyPlans[activeActivity.di].activities[activeActivity.ai]}
          day={plan.dailyPlans[activeActivity.di].day}
          dayTheme={plan.dailyPlans[activeActivity.di].theme}
          travelers={plan.travelers || []}
          destination={plan.destination}
          onClose={() => setActiveActivity(null)}
          onUpdate={(field, value) => updateActivity(activeActivity.di, activeActivity.ai, field, value)}
          onRemove={() => removeActivity(activeActivity.di, activeActivity.ai)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ACTIVITY MODAL
// ═══════════════════════════════════════════════════════
function ActivityModal({
  activity,
  day,
  dayTheme,
  travelers,
  destination,
  onClose,
  onUpdate,
  onRemove,
}: {
  activity: any;
  day: number;
  dayTheme?: string;
  travelers: any[];
  destination: string;
  onClose: () => void;
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
}) {
  const a = activity;
  const t = a.transport || {};
  const [editedTitle, setEditedTitle] = useState(a.title || '');
  const [editedDesc, setEditedDesc] = useState(a.description || '');

  const highlights = (a.description || '')
    .split(/[.!?]+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 10)
    .slice(0, 4);

  function pickEmoji(title: string): string {
    const t = (title || '').toLowerCase();
    if (t.includes('temple') || t.includes('shrine') || t.includes('castle')) return '⛩️';
    if (t.includes('museum') || t.includes('gallery') || t.includes('art')) return '🎨';
    if (t.includes('park') || t.includes('garden') || t.includes('zoo')) return '🌳';
    if (t.includes('dinner') || t.includes('lunch') || t.includes('restaurant') || t.includes('food') || t.includes('dining')) return '🍽️';
    if (t.includes('cruise') || t.includes('boat') || t.includes('river')) return '🚤';
    if (t.includes('disney') || t.includes('universal') || t.includes('theme park')) return '🎢';
    if (t.includes('shopping') || t.includes('market')) return '🛍️';
    if (t.includes('spa') || t.includes('onsen') || t.includes('relax')) return '💆';
    if (t.includes('kids') || t.includes('play')) return '🧸';
    if (t.includes('airport') || t.includes('flight')) return '✈️';
    if (t.includes('pick up') || t.includes('return rental')) return '🚗';
    if (t.includes('hotel') || t.includes('check-in') || t.includes('check in')) return '🏨';
    if (t.includes('view') || t.includes('tower') || t.includes('peak')) return '🌆';
    if (t.includes('train') || t.includes('station')) return '🚆';
    return '📍';
  }

  const emoji = pickEmoji(a.title);
  const heroImage = `https://picsum.photos/seed/${encodeURIComponent(a.title)}/800/600`;

  function saveAndClose() {
    if (editedTitle !== a.title) onUpdate('title', editedTitle);
    if (editedDesc !== a.description) onUpdate('description', editedDesc);
    onClose();
  }

  function askConcierge() {
    const question = `Tell me more about "${a.title}" on Day ${day}. What should I know before going?`;
    navigator.clipboard.writeText(question).then(() => {
      alert(
        `Question copied to clipboard:\n\n"${question}"\n\nPaste it in your Telegram chat with the concierge.`
      );
      window.open('https://t.me/familytrip_ai_bot', '_blank');
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-6 flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-4">
            <input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-2xl font-bold w-full outline-none focus:bg-gray-50 rounded px-2 py-1"
            />
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 px-2">
              <span>Day {day}</span>
              {dayTheme && (
                <>
                  <span>·</span>
                  <span>{dayTheme}</span>
                </>
              )}
              <span>·</span>
              <span className="font-mono">{a.time}</span>
            </div>
          </div>
          <button
            onClick={saveAndClose}
            className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
          >
            <span className="text-xl">✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid md:grid-cols-3 gap-6">
          {/* Left: image */}
          <div className="md:col-span-1">
            <div
              className="aspect-square rounded-xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(135deg, #0d4d3d 0%, #2a7a63 100%)',
              }}
            >
              <img
                src={heroImage}
                alt={a.title}
                className="w-full h-full object-cover absolute inset-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-90 pointer-events-none">
                {emoji}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {a.kidFriendly && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  👶 Kid friendly
                </span>
              )}
              {a.elderlyFriendly && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  👴 Senior access
                </span>
              )}
            </div>
          </div>

          {/* Middle: transport */}
          <div className="md:col-span-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              🚗 How to get there
            </p>
            <div className="space-y-3">
              {t.car?.available && (
                <div
                  className={`rounded-lg p-3 text-sm border-2 ${
                    t.recommended === 'car'
                      ? 'border-green-700 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm">🚗 By car</span>
                    <span className="font-bold">${t.car.cost}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">
                    ⏱ {t.car.duration} · 📏 {t.car.distance}
                  </p>
                  <p className="text-xs text-gray-600">{t.car.details}</p>
                </div>
              )}

              {t.public?.available && (
                <div
                  className={`rounded-lg p-3 text-sm border-2 ${
                    t.recommended === 'public'
                      ? 'border-green-700 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm">🚇 Public</span>
                    <span className="font-bold">${t.public.cost}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">⏱ {t.public.duration}</p>
                  <p className="text-xs text-gray-600 mb-1">{t.public.details}</p>
                  {t.public.line && (
                    <p className="text-xs text-gray-500">🚇 {t.public.line}</p>
                  )}
                  {t.public.frequency && (
                    <p className="text-xs text-gray-500">🕐 {t.public.frequency}</p>
                  )}
                  {t.public.walkTime && (
                    <p className="text-xs text-gray-500">🚶 {t.public.walkTime}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: at a glance */}
          <div className="md:col-span-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              ℹ️ At a glance
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Time</span>
                <span className="font-medium">{a.time}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Cost</span>
                <span className="font-medium">${a.cost_usd || 0}</span>
              </div>
              {(a.cost_usd || 0) > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Miles earned</span>
                  <span className="font-medium text-amber-700">
                    ✨ {Math.floor((a.cost_usd || 0) / 15)} miles
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Family</span>
                <span className="font-medium">
                  {a.kidFriendly && a.elderlyFriendly
                    ? 'All ages'
                    : a.kidFriendly
                    ? 'Kids OK'
                    : a.elderlyFriendly
                    ? 'Seniors OK'
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Travelers</span>
                <span className="font-medium">{travelers.length}</span>
              </div>
            </div>
            {a.next && (
              <div className="mt-4 bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">⏭ What's next</p>
                <p className="text-xs text-blue-900">{a.next}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="px-6 pb-6">
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              About this activity
            </p>
            <textarea
              value={editedDesc}
              onChange={(e) => setEditedDesc(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 outline-none focus:border-green-700 resize-none"
            />
          </div>

          {highlights.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Highlights
              </p>
              <ul className="space-y-1">
                {highlights.map((h: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-green-700">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${a.title}, ${destination}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium text-center"
            >
              🗺 Google Maps
            </a>
            <button
              onClick={onRemove}
              className="px-4 py-2.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium"
            >
              🗑 Remove
            </button>
            <button
              onClick={saveAndClose}
              className="flex-1 min-w-[160px] text-white px-4 py-2.5 rounded-lg font-semibold text-sm"
              style={{ backgroundColor: '#0d4d3d' }}
            >
              ✓ Save & close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}