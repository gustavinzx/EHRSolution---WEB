const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const runSeed = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('Running schema...');
    const schema = fs.readFileSync(path.join(__dirname, '../config/schema.sql'), 'utf-8');
    await client.query(schema);
    const migration = fs.readFileSync(path.join(__dirname, '../config/migration.sql'), 'utf-8');
    await client.query(migration);

    console.log('Inserting demo users...');
    // DADOS DEMO — substituir por dados reais
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Demo@1234', salt);
    await client.query(`
      INSERT INTO users (email, password_hash, name) 
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO NOTHING
    `, ['gestor@ehr.com', hash, 'Gestor Demo']);

    console.log('Inserting demo drivers...');
    // DADOS DEMO — substituir por dados reais
    const drivers = [
      'João Silva', 'Maria Oliveira', 'Carlos Souza', 'Ana Santos',
      'Pedro Costa', 'Fernanda Lima', 'Lucas Pereira', 'Juliana Carvalho',
      'Marcos Ribeiro', 'Camila Alves'
    ];
    
    for (const [index, driver] of drivers.entries()) {
      await client.query(`
        INSERT INTO drivers (id, name, phone, email, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (id) DO NOTHING
      `, [index + 1, driver, `1199999${index.toString().padStart(4, '0')}`, `motorista${index + 1}@ehr.com`]);
    }

    // Reset sequence
    await client.query("SELECT setval('drivers_id_seq', (SELECT MAX(id) FROM drivers))");

    console.log('Inserting demo trucks...');
    // DADOS DEMO — substituir por dados reais
    const trucks = [
      { id: 1, plate: 'ABC-1234', model: 'Volvo FH', cap: 500, lvl: 450, lat: -23.5505, lng: -46.6333, status: 'ok' },
      { id: 2, plate: 'XYZ-9876', model: 'Scania R450', cap: 400, lvl: 80, lat: -22.9068, lng: -43.1729, status: 'low_fuel' },
      { id: 3, plate: 'DEF-5678', model: 'Mercedes Actros', cap: 600, lvl: 500, lat: -19.9208, lng: -43.9378, status: 'ok' },
      { id: 4, plate: 'GHI-1D23', model: 'Volvo FH', cap: 500, lvl: 250, lat: -15.7942, lng: -47.8822, status: 'ok' },
      { id: 5, plate: 'JKL-4567', model: 'Scania R500', cap: 600, lvl: 150, lat: -30.0346, lng: -51.2177, status: 'ok' },
      { id: 6, plate: 'MNO-8901', model: 'Mercedes Atego', cap: 300, lvl: 290, lat: -25.4284, lng: -49.2733, status: 'ok' },
      { id: 7, plate: 'PQR-2345', model: 'Volvo VM', cap: 350, lvl: 50, lat: -8.0476, lng: -34.8770, status: 'low_fuel' },
      { id: 8, plate: 'STU-6789', model: 'Scania G410', cap: 450, lvl: 400, lat: -3.7319, lng: -38.5267, status: 'ok' },
      { id: 9, plate: 'VWX-0123', model: 'Mercedes Axor', cap: 550, lvl: 100, lat: -12.9714, lng: -38.5014, status: 'low_fuel' },
      { id: 10, plate: 'YZA-4B56', model: 'Volvo FH', cap: 600, lvl: 580, lat: -16.6869, lng: -49.2648, status: 'no_signal' }
    ];

    for (const t of trucks) {
      await client.query(`
        INSERT INTO trucks (id, plate, model, capacity_liters, current_level_liters, lat, lng, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          plate = EXCLUDED.plate,
          model = EXCLUDED.model
      `, [t.id, t.plate, t.model, t.cap, t.lvl, t.lat, t.lng, t.status]);
    }
    
    // Reset sequence
    await client.query("SELECT setval('trucks_id_seq', (SELECT MAX(id) FROM trucks))");

    console.log('Inserting fuel stations...');
    const stations = [
      ['Posto EHR São Paulo', 'EHR Fuel', 'São Paulo, SP', -23.5505, -46.6333],
      ['Posto EHR Rio', 'EHR Fuel', 'Rio de Janeiro, RJ', -22.9068, -43.1729],
      ['Posto EHR Brasília', 'EHR Fuel', 'Brasília, DF', -15.7942, -47.8822],
      ['Posto EHR Curitiba', 'EHR Fuel', 'Curitiba, PR', -25.4284, -49.2733],
      ['Posto EHR Salvador', 'EHR Fuel', 'Salvador, BA', -12.9714, -38.5014],
      ['Posto EHR Fortaleza', 'EHR Fuel', 'Fortaleza, CE', -3.7319, -38.5267],
      ['Posto EHR Porto Alegre', 'EHR Fuel', 'Porto Alegre, RS', -30.0346, -51.2177]
    ];
    for (const [name, brand, address, lat, lng] of stations) {
      await client.query(`INSERT INTO fuel_stations (name, brand, address, lat, lng, source) VALUES ($1,$2,$3,$4,$5,'seed') ON CONFLICT DO NOTHING`, [name, brand, address, lat, lng]);
    }

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
          const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) });
          const osrmData = await osrmRes.json();
          
          if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
            const geometry = osrmData.routes[0].geometry.coordinates;
            await client.query(`
              UPDATE trucks 
              SET origin_name = $1, dest_name = $2, route_geometry = $3, route_index = 0, lat = $4, lng = $5
              WHERE id = $6
            `, [originData.name, destData.name, JSON.stringify(geometry), originData.lat, originData.lng, i + 1]);
            
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


    console.log('Inserting demo driver_trucks...');
    // DADOS DEMO — substituir por dados reais
    const driverTrucks = [
      { d: 1, t: 1 }, { d: 1, t: 2 },
      { d: 2, t: 3 },
      { d: 3, t: 4 }, { d: 3, t: 5 },
      { d: 4, t: 6 },
      { d: 5, t: 7 },
      { d: 6, t: 8 },
      { d: 7, t: 9 },
      { d: 8, t: 10 }
    ];

    for (const dt of driverTrucks) {
      await client.query(`
        INSERT INTO driver_trucks (driver_id, truck_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [dt.d, dt.t]);
    }

    console.log('Inserting demo fueling_logs...');
    // DADOS DEMO — substituir por dados reais
    for (let i = 1; i <= 30; i++) {
      const driverId = Math.floor(Math.random() * 8) + 1;
      const truckId = driverId; // Simplification for demo
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      const methods = ['facial', 'ble_fallback'];
      const method = methods[Math.floor(Math.random() * methods.length)];
      
      const levelBefore = Math.floor(Math.random() * 200) + 50;
      const levelAfter = levelBefore + Math.floor(Math.random() * 200) + 100;
      
      const truckData = trucks.find(t => t.id === truckId) || trucks[0];

      await client.query(`
        INSERT INTO fueling_logs (driver_id, truck_id, timestamp, lat, lng, level_before, level_after, release_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [driverId, truckId, date, truckData.lat, truckData.lng, levelBefore, levelAfter, method]);
    }

    console.log('Inserting demo telemetry_logs (routes)...');
    // DADOS DEMO - gerar rotas simuladas para os caminhões
    // Vamos gerar as últimas 3 horas de telemetria (1 ponto a cada 5 min = ~36 pontos)
    for (const t of trucks) {
      let currentLat = t.lat;
      let currentLng = t.lng;
      let currentFuel = t.lvl + 30; // Começa um pouco mais cheio 3h atrás

      for (let i = 36; i >= 0; i--) {
        const time = new Date();
        time.setMinutes(time.getMinutes() - (i * 5));

        // Simula movimento: altera lat/lng um pouquinho
        if (t.status !== 'no_signal') {
          currentLat += (Math.random() - 0.5) * 0.01;
          currentLng += (Math.random() - 0.5) * 0.01;
          // Simula consumo: cai um pouquinho
          currentFuel = Math.max(0, currentFuel - (Math.random() * 2));
        }
        
        const speed = t.status === 'no_signal' ? 0 : Math.floor(Math.random() * 80) + 40;

        await client.query(`
          INSERT INTO telemetry_logs (truck_id, timestamp, lat, lng, speed_kmh, fuel_level_liters)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [t.id, time, currentLat, currentLng, speed, currentFuel]);
      }
      
      // Atualizar o truck com a posição final da simulação
      await client.query(`
        UPDATE trucks SET lat = $1, lng = $2, current_level_liters = $3, speed_kmh = $4 WHERE id = $5
      `, [currentLat, currentLng, currentFuel, t.status === 'no_signal' ? 0 : 80, t.id]);
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
  } finally {
    client.release();
    pool.end();
  }
};

runSeed();
