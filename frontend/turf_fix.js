function getDistanceToIndex(coords, index) {
  let dist = 0;
  for (let i = 0; i < index && i < coords.length - 1; i++) {
    dist += turf.distance(turf.point(coords[i]), turf.point(coords[i+1]), { units: 'meters' });
  }
  return dist;
}
