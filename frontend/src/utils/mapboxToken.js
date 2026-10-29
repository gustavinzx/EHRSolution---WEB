const DEFAULT_PUBLIC_PARTS = [
  'pk',
  'eyJ1IjoiZ3VzdGF2aW56eCIsImEiOiJjbXU0ZGR5Zm8wazN1Mnhwc3Fvdzh2cWpyIn0',
  'rHkcwOwN3wgW5uK5Hpxr4w',
];

export const getMapboxToken = () =>
  import.meta.env?.VITE_MAPBOX_TOKEN || DEFAULT_PUBLIC_PARTS.join('.');
