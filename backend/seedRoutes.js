const { pool } = require('./src/config/db');

const routes = [
  { origin: 'São Paulo, SP', dest: 'Rio de Janeiro, RJ' },
  { origin: 'Brasília, DF', dest: 'Goiânia, GO' },
  { origin: 'Curitiba, PR', dest: 'Florianópolis, SC' },
  { origin: 'Belo Horizonte, MG', dest: 'Vitória, ES' },
  { origin: 'Salvador, BA', dest: 'Aracaju, SE' },
  { origin: 'Recife, PE', dest: 'João Pessoa, PB' },
  { origin: 'Fortaleza, CE', dest: 'Natal, RN' },
  { origin: 'Porto Alegre, RS', dest: 'Caxias do Sul, RS' },
  { origin: 'Cuiabá, MT', dest: 'Campo Grande, MS' },
  { origin: 'Manaus, AM', dest: 'Boa Vista, RR' } // will it find road? maybe. Let's try.
];

async function seedRoutes() {
  const getCoords = async (address) => {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'EHR-Fleet-Prototype/1.0' }
    });
    const data = await response.json();
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
  };

  for (let i = 0; i < 10; i++) {
    try {
      const { origin, dest } = routes[i];
      console.log(`Fetching route ${i+1}: ${origin} -> ${dest}`);
      
      const originData = await getCoords(origin);
      const destData = await getCoords(dest);
      
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${originData.lng},${originData.lat};${destData.lng},${destData.lat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      
      if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
        const geometry = osrmData.routes[0].geometry.coordinates;
        await pool.query(`
          UPDATE trucks 
          SET origin_name = $1, dest_name = $2, route_geometry = $3, route_index = 0, lat = $4, lng = $5
          WHERE id = $6
        `, [originData.name, destData.name, JSON.stringify(geometry), originData.lat, originData.lng, i + 1]);
        console.log(`Truck ${i+1} updated.`);
      }
      
      // sleep 1s to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log(`Failed for truck ${i+1}:`, e.message);
    }
  }
  pool.end();
  console.log('Done!');
}

seedRoutes();
