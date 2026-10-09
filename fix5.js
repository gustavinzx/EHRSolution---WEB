const fs = require('fs');
let c = fs.readFileSync('backend/src/controllers/fuelingController.js', 'utf8');
c = c.replace(/if \(!updated\) return res\.status\(409\)\.json\(\{ error: "Sessão já foi processada" \}\);\s*const full = await loadSession\(id\);/g, `if (!updated) return res.status(409).json({ error: "Sessão já foi processada" });
      if (method === 'ble_fallback') {
        await db.query("INSERT INTO fleet_alerts (truck_id, type, severity, message) VALUES ($1, 'ble_fallback_used', 'attention', 'Abastecimento liberado via BLE Fallback sem biometria facial.')", [session.truck_id]);
        if (req.io) req.io.emit('newAlert', { truck_id: session.truck_id });
      }
      const full = await loadSession(id);`);
fs.writeFileSync('backend/src/controllers/fuelingController.js', c);
