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
