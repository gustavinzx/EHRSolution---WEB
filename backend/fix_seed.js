const fs = require("fs");
let content = fs.readFileSync("src/seed/seed.js", "utf8");

const fetchLogic = `
    console.log('Fetching route geometries from OSRM...');
    const routes_list = [
      { origin: 'São Paulo, SP', dest: 'Rio de Janeiro, RJ' },
      { origin: 'Brasília, DF', dest: 'Goiânia, GO' },
      { origin: 'Curitiba, PR', dest: 'Florianópolis, SC' },
      { origin: 'Belo Horizonte, MG', dest: 'Vitória, ES' },
      { origin: 'Salvador, BA', dest: 'Aracaju, SE' },
      { origin: 'Recife, PE', dest: 'João Pessoa, PB' },
      { origin: 'Fortaleza, CE', dest: 'Natal, RN' },
      { origin: 'Porto Alegre, RS', dest: 'Caxias do Sul, RS' },
      { origin: 'Cuiabá, MT', dest: 'Campo Grande, MS' },
      { origin: 'Manaus, AM', dest: 'Boa Vista, RR' }
    ];

    const getCoords = async (address) => {
      try {
        const response = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) + '&format=json&limit=1', {
          headers: { 'User-Agent': 'EHR-Fleet-Prototype/1.0' }
        });
        const data = await response.json();
        if (!data || data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
      } catch (e) {
        console.error('Failed to get coords for ' + address + ':', e.message);
        return null;
      }
    };

    for (let i = 0; i < 10; i++) {
      try {
        const { origin, dest } = routes_list[i];
        console.log('Fetching route ' + (i+1) + ': ' + origin + ' -> ' + dest);
        
        const originData = await getCoords(origin);
        const destData = await getCoords(dest);
        
        if (originData && destData) {
          const osrmUrl = 'http://router.project-osrm.org/route/v1/driving/' + originData.lng + ',' + originData.lat + ';' + destData.lng + ',' + destData.lat + '?overview=full&geometries=geojson';
          const osrmRes = await fetch(osrmUrl);
          const osrmData = await osrmRes.json();
          
          if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
            const geometry = osrmData.routes[0].geometry.coordinates;
            await client.query(\`
              UPDATE trucks 
              SET origin_name = $1, dest_name = $2, route_geometry = $3, route_index = 0, lat = $4, lng = $5
              WHERE id = $6
            \`, [originData.name, destData.name, JSON.stringify(geometry), originData.lat, originData.lng, i + 1]);
            
            // update local trucks array to start telemetry at origin
            trucks[i].lat = originData.lat;
            trucks[i].lng = originData.lng;
          } else {
             console.log('[AVISO] OSRM não retornou rota para caminhão ' + (i+1));
          }
        } else {
           console.log('[AVISO] Nominatim não encontrou coordenadas para caminhão ' + (i+1));
        }
        
        // sleep to avoid rate limit
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.log('Failed for truck ' + (i+1) + ':', e.message);
      }
    }
`;

content = content.replace("// Reset sequence\n    await client.query(\"SELECT setval('trucks_id_seq', (SELECT MAX(id) FROM trucks))\");", 
  "// Reset sequence\n    await client.query(\"SELECT setval('trucks_id_seq', (SELECT MAX(id) FROM trucks))\");\n" + fetchLogic);

fs.writeFileSync("src/seed/seed.js", content);
