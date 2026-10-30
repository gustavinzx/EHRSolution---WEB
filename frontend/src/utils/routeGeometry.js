export function normalizeRoute(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const coordinates = value?.geometry?.coordinates ?? value?.coordinates ?? value;
    return Array.isArray(coordinates) && coordinates.length > 1 &&
      coordinates.every(p => Array.isArray(p) && p.length >= 2 &&
        Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
      ? coordinates : null;
  } catch { return null; }
}
