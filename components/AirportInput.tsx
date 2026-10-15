'use client';

import { useEffect, useRef, useState } from 'react';
import { Airport, searchAirports, formatAirport } from '@/lib/airports';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabledCode?: string;
  error?: boolean;
};

export default function AirportInput({ value, onChange, placeholder, disabledCode, error }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInput(v: string) {
    setQuery(v);
    onChange(v);
    const matches = searchAirports(v);
    setResults(matches);
    setHighlighted(0);
    setOpen(matches.length > 0);
  }

  function selectAirport(a: Airport) {
    const formatted = formatAirport(a);
    setQuery(formatted);
    onChange(formatted);
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => {
        let next = h + 1;
        while (
          next < results.length &&
          disabledCode &&
          results[next].code === disabledCode
        )
          next++;
        return Math.min(next, results.length - 1);
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => {
        let next = h - 1;
        while (
          next >= 0 &&
          disabledCode &&
          results[next].code === disabledCode
        )
          next--;
        return Math.max(next, 0);
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[highlighted];
      if (selected && (!disabledCode || selected.code !== disabledCode)) {
        selectAirport(selected);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Start typing a city...'}
        className={`w-full text-lg font-semibold outline-none bg-transparent ${
          error ? 'text-red-600' : 'text-black'
        }`}
        autoComplete="off"
      />

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((a, i) => {
            const isDisabled = Boolean(
              disabledCode && a.code === disabledCode
            );
            return (
              <button
                key={a.code}
                type="button"
                onClick={() => !isDisabled && selectAirport(a)}
                onMouseEnter={() => !isDisabled && setHighlighted(i)}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition ${
                  isDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : i === highlighted
                    ? 'bg-green-50'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {a.city}{' '}
                      <span className="text-gray-400 font-normal">
                        · {a.country}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {a.name}
                      {isDisabled && ' (same as departure)'}
                    </p>
                  </div>
                  <span
                    className="text-xs font-mono font-bold px-2 py-1 rounded"
                    style={{
                      backgroundColor: isDisabled ? '#e5e7eb' : '#e8f0ed',
                      color: isDisabled ? '#9ca3af' : '#0d4d3d',
                    }}
                  >
                    {a.code}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}