async function run() {
  const url = `http://router.project-osrm.org/route/v1/driving/-38.5014,-12.9714;-46.6333,-23.5505?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("length:", data.routes[0].geometry.coordinates.length);
  process.exit();
}
run();
