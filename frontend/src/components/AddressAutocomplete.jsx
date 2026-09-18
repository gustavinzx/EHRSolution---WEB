import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

export default function AddressAutocomplete({ placeholder, value, onChange }) {
  const [query, setQuery] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync prop value to local state
  useEffect(() => {
    if (value && value.name && value.name !== query) {
      setQuery(value.name);
    }
  }, [value]);

  useEffect(() => {
    const fetchPlaces = async () => {
      if (!query || query.length < 3 || (value && query === value.name)) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=br&limit=5`);
        const data = await res.json();
        
        if (data.features) {
          const formatted = data.features.map(f => ({
            name: f.place_name,
            lat: f.center[1],
            lng: f.center[0]
          }));
          setResults(formatted);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Error fetching Mapbox places:', error);
      } finally {
        setLoading(false);
      }
    };

    const delay = setTimeout(fetchPlaces, 400); // debounce 400ms
    return () => clearTimeout(delay);
  }, [query, value]);

  const handleSelect = (place) => {
    setQuery(place.name);
    setIsOpen(false);
    onChange(place);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value && e.target.value !== value.name) {
              onChange(null); // Clear selection se usuario editar
            }
          }}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          style={{
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', padding: '12px 14px 12px 38px', borderRadius: '10px',
            width: '100%', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocusCapture={e => { e.target.style.borderColor='rgba(56,189,248,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(56,189,248,0.1)'; }}
          onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
        />
        {loading && (
          <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', right: '14px', color: 'var(--teal)' }} />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', marginTop: '6px', padding: '6px 0',
          listStyle: 'none', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          maxHeight: '220px', overflowY: 'auto'
        }}>
          {results.map((place, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(place)}
              style={{
                padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px',
                borderBottom: idx === results.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <MapPin size={16} style={{ color: 'var(--teal)', marginTop: '2px', flexShrink: 0 }} />
              <span style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '1.4' }}>{place.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
