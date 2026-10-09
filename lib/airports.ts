// Top 60 airports covering the common hackathon demo routes
export type Airport = {
  code: string;   // IATA code
  city: string;
  name: string;
  country: string;
};

export const AIRPORTS: Airport[] = [
  // Asia - Southeast
  { code: 'CGK', city: 'Jakarta', name: 'Soekarno-Hatta International', country: 'Indonesia' },
  { code: 'DPS', city: 'Bali', name: 'Ngurah Rai International', country: 'Indonesia' },
  { code: 'SUB', city: 'Surabaya', name: 'Juanda International', country: 'Indonesia' },
  { code: 'KUL', city: 'Kuala Lumpur', name: 'Kuala Lumpur International', country: 'Malaysia' },
  { code: 'SIN', city: 'Singapore', name: 'Changi', country: 'Singapore' },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'Thailand' },
  { code: 'DMK', city: 'Bangkok', name: 'Don Mueang International', country: 'Thailand' },
  { code: 'HKT', city: 'Phuket', name: 'Phuket International', country: 'Thailand' },
  { code: 'MNL', city: 'Manila', name: 'Ninoy Aquino International', country: 'Philippines' },
  { code: 'SGN', city: 'Ho Chi Minh City', name: 'Tan Son Nhat International', country: 'Vietnam' },
  { code: 'HAN', city: 'Hanoi', name: 'Noi Bai International', country: 'Vietnam' },

  // Asia - East
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong International', country: 'Hong Kong' },
  { code: 'NRT', city: 'Tokyo', name: 'Narita International', country: 'Japan' },
  { code: 'HND', city: 'Tokyo', name: 'Haneda', country: 'Japan' },
  { code: 'KIX', city: 'Osaka', name: 'Kansai International', country: 'Japan' },
  { code: 'CTS', city: 'Sapporo', name: 'New Chitose', country: 'Japan' },
  { code: 'FUK', city: 'Fukuoka', name: 'Fukuoka', country: 'Japan' },
  { code: 'ICN', city: 'Seoul', name: 'Incheon International', country: 'South Korea' },
  { code: 'GMP', city: 'Seoul', name: 'Gimpo International', country: 'South Korea' },
  { code: 'PEK', city: 'Beijing', name: 'Capital International', country: 'China' },
  { code: 'PVG', city: 'Shanghai', name: 'Pudong International', country: 'China' },
  { code: 'CAN', city: 'Guangzhou', name: 'Baiyun International', country: 'China' },
  { code: 'TPE', city: 'Taipei', name: 'Taoyuan International', country: 'Taiwan' },

  // Asia - South
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi International', country: 'India' },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji', country: 'India' },
  { code: 'BLR', city: 'Bangalore', name: 'Kempegowda International', country: 'India' },
  { code: 'MAA', city: 'Chennai', name: 'Chennai International', country: 'India' },
  { code: 'CMB', city: 'Colombo', name: 'Bandaranaike International', country: 'Sri Lanka' },

  // Middle East
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'UAE' },
  { code: 'AUH', city: 'Abu Dhabi', name: 'Zayed International', country: 'UAE' },
  { code: 'DOH', city: 'Doha', name: 'Hamad International', country: 'Qatar' },
  { code: 'IST', city: 'Istanbul', name: 'Istanbul Airport', country: 'Turkey' },

  // Europe
  { code: 'LHR', city: 'London', name: 'Heathrow', country: 'UK' },
  { code: 'LGW', city: 'London', name: 'Gatwick', country: 'UK' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'France' },
  { code: 'AMS', city: 'Amsterdam', name: 'Schiphol', country: 'Netherlands' },
  { code: 'FRA', city: 'Frankfurt', name: 'Frankfurt Airport', country: 'Germany' },
  { code: 'MUC', city: 'Munich', name: 'Munich Airport', country: 'Germany' },
  { code: 'FCO', city: 'Rome', name: 'Fiumicino', country: 'Italy' },
  { code: 'MXP', city: 'Milan', name: 'Malpensa', country: 'Italy' },
  { code: 'MAD', city: 'Madrid', name: 'Barajas', country: 'Spain' },
  { code: 'BCN', city: 'Barcelona', name: 'El Prat', country: 'Spain' },
  { code: 'ZRH', city: 'Zurich', name: 'Zurich Airport', country: 'Switzerland' },
  { code: 'VIE', city: 'Vienna', name: 'Vienna International', country: 'Austria' },

  // North America
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy', country: 'USA' },
  { code: 'EWR', city: 'New York', name: 'Newark Liberty', country: 'USA' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International', country: 'USA' },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International', country: 'USA' },
  { code: 'ORD', city: 'Chicago', name: "O'Hare International", country: 'USA' },
  { code: 'SEA', city: 'Seattle', name: 'Tacoma International', country: 'USA' },
  { code: 'BOS', city: 'Boston', name: 'Logan International', country: 'USA' },
  { code: 'MIA', city: 'Miami', name: 'Miami International', country: 'USA' },
  { code: 'YYZ', city: 'Toronto', name: 'Pearson International', country: 'Canada' },
  { code: 'YVR', city: 'Vancouver', name: 'Vancouver International', country: 'Canada' },

  // Oceania
  { code: 'SYD', city: 'Sydney', name: 'Kingsford Smith', country: 'Australia' },
  { code: 'MEL', city: 'Melbourne', name: 'Tullamarine', country: 'Australia' },
  { code: 'BNE', city: 'Brisbane', name: 'Brisbane Airport', country: 'Australia' },
  { code: 'AKL', city: 'Auckland', name: 'Auckland Airport', country: 'New Zealand' },
];

/**
 * Search airports by city, code, or name.
 * Returns up to 8 results, ranked by relevance.
 */
export function searchAirports(query: string): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = AIRPORTS.map((a) => {
    const city = a.city.toLowerCase();
    const code = a.code.toLowerCase();
    const name = a.name.toLowerCase();

    let score = 0;
    if (code === q) score = 100;
    else if (city === q) score = 90;
    else if (city.startsWith(q)) score = 80;
    else if (code.startsWith(q)) score = 70;
    else if (name.startsWith(q)) score = 60;
    else if (city.includes(q)) score = 50;
    else if (name.includes(q)) score = 40;

    return { airport: a, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.airport);

  return scored;
}

export function formatAirport(a: Airport): string {
  return `${a.city} (${a.code})`;
}