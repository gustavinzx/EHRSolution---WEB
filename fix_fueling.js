const fs = require('fs');
let c = fs.readFileSync('backend/src/controllers/fuelingController.js', 'utf8');

c = c.replace(/const method = \["facial", "ble_fallback", "manager_override"\]\.includes\(release_method\) \? release_method : "facial";/, `let method = release_method || 'facial';
    if (req.actor.type === 'driver') {
      if (method !== 'facial' && method !== 'ble_fallback') {
        return res.status(400).json({ error: 'invalid_release_method' });
      }
    } else {
      method = ["facial", "ble_fallback", "manager_override"].includes(method) ? method : "facial";
    }`);

c = c.replace(/if \(session\.release_method === 'facial'\) \{[\s\S]*?if \(!session\.ble_confirmed_at\) return res\.status\(403\)\.json\(\{ error: "ble_confirmation_required" \}\);\n    \}/, `const effectiveMethod = req.actor.type === "manager" ? "manager_override" : session.release_method;
    if (req.actor.type === "driver" && effectiveMethod !== 'facial' && effectiveMethod !== 'ble_fallback') {
      return res.status(403).json({ error: 'driver_cannot_use_manager_override' });
    }

    if (effectiveMethod === 'facial') {
      if (session.facial_consumed_at) return res.status(403).json({ error: "facial_verification_already_used" });
      if (!session.facial_verified_at) return res.status(403).json({ error: "facial_verification_required" });
      const verifiedAt = new Date(session.facial_verified_at).getTime();
      if (Date.now() - verifiedAt > 2 * 60 * 1000) return res.status(403).json({ error: "facial_verification_expired" });
    } else if (effectiveMethod === 'ble_fallback') {
      if (!session.ble_confirmed_at) return res.status(403).json({ error: "ble_confirmation_required" });
      if (session.ble_consumed_at) return res.status(403).json({ error: "ble_confirmation_already_used" });
      const confirmedAt = new Date(session.ble_confirmed_at).getTime();
      if (Date.now() - confirmedAt > 2 * 60 * 1000) return res.status(403).json({ error: "ble_confirmation_expired" });
    }`);

c = c.replace(/const method = req\.actor\.type === "manager" \? "manager_override" : \(session\.release_method \|\| "facial"\);\n    const updated = await authorizeAndUnlock\(id, method, \{ authorized_by: req\.actor\.type, authorized_by_id: req\.actor\.id \}\);/, `const updated = await authorizeAndUnlock(id, effectiveMethod, { authorized_by: req.actor.type, authorized_by_id: req.actor.id }, req.actor.type);`);

c = c.replace(/if \(method === 'ble_fallback'\) \{\n\s*await db\.query\("INSERT INTO fleet_alerts \(truck_id, type, severity, message\) VALUES \(\$1, 'ble_fallback_used', 'medium', 'Abastecimento liberado via BLE Fallback sem biometria facial\.'\)", \[session\.truck_id\]\);\n\s*if \(req\.io\) req\.io\.emit\('newAlert', \{ truck_id: session\.truck_id \}\);\n\s*\}/, `if (effectiveMethod === 'ble_fallback') {
        const al = await db.query(\`INSERT INTO fleet_alerts (truck_id, type, severity, message, plate, model) 
          SELECT $1, 'ble_fallback_used', 'medium', 'Abastecimento liberado via BLE Fallback sem biometria facial.', t.plate, t.model
          FROM trucks t WHERE t.id = $1 RETURNING *\`, [session.truck_id]);
        if (req.io && al.rows[0]) req.io.emit('newAlert', al.rows[0]);
      }`);

c = c.replace(/const updated = await authorizeAndUnlock\(session\.id, "manager_override", \{/, `const updated = await authorizeAndUnlock(session.id, "manager_override", {`);
c = c.replace(/const updated = await authorizeAndUnlock\(sessionId, "manager_override", \{/, `const updated = await authorizeAndUnlock(sessionId, "manager_override", {`);

fs.writeFileSync('backend/src/controllers/fuelingController.js', c);
