const fs = require('fs');
let c = fs.readFileSync('backend/src/controllers/fuelingController.js', 'utf8');

const newVerifyFace = `exports.verifyFace = async (req, res) => {
  let client;
  let clientReleased = false;
  try {
    const { id } = req.params;
    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ error: "image_base64 é obrigatório" });
    
    const { validateImageBase64 } = require('../services/imageValidation');
    const { buffer } = validateImageBase64(image_base64);

    client = await db.pool.connect();
    await client.query("BEGIN");

    const { rows: sessions } = await client.query("SELECT * FROM fueling_sessions WHERE id=$1 AND status='requested' FOR UPDATE", [id]);
    if (!sessions.length) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(404).json({ error: "Sessão não encontrada" });
    }
    const session = sessions[0];
    
    if (session.driver_id !== req.actor.id) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(403).json({ error: "Sessão de outro motorista" });
    }

    const { rows: drivers } = await client.query("SELECT face_enrolled, face_template_ref FROM drivers WHERE id=$1", [req.actor.id]);
    if (!drivers[0]?.face_enrolled || !drivers[0]?.face_template_ref) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(409).json({ error: "face_not_enrolled" });
    }

    const { rows: limits } = await client.query("SELECT COUNT(*) as cnt FROM facial_attempts WHERE driver_id=$1 AND created_at >= NOW() - INTERVAL '1 hour'", [req.actor.id]);
    if (parseInt(limits[0].cnt) >= 10) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(429).json({ error: "Limite de tentativas por hora atingido." });
    }

    const { rows: sessionAtt } = await client.query("SELECT COUNT(*) as cnt FROM facial_attempts WHERE session_id=$1", [id]);
    if (parseInt(sessionAtt[0].cnt) >= 3) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(429).json({ error: "Limite de tentativas da sessão atingido." });
    }

    let providerResult;
    let providerName = process.env.FACE_PROVIDER || 'disabled';
    try {
      providerResult = await faceProvider.verify(req.actor.id, drivers[0].face_template_ref, buffer);
    } catch(e) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      await security.recordSecurityEvent({
        truckId: session.truck_id,
        type: "face_provider_error",
        severity: "high",
        source: "app",
        payload: { error: e.message, provider: providerName },
        io: req.io
      });
      return res.status(503).json({ error: 'face_provider_unavailable' });
    }

    const threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.90");
    const isSuccess = providerResult.match && providerResult.score >= threshold && providerResult.livenessPassed;
    
    const { rows: attemptIns } = await client.query(
      "INSERT INTO facial_attempts (session_id, driver_id, truck_id, success, score, liveness_passed, provider, failure_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
      [id, req.actor.id, session.truck_id, isSuccess, providerResult.score || 0, !!providerResult.livenessPassed, providerName, providerResult.error || null]
    );

    if (isSuccess) {
      await client.query("UPDATE fueling_sessions SET facial_verified_at=NOW(), facial_attempt_id=$1 WHERE id=$2", [attemptIns[0].id, id]);
      await client.query("COMMIT");
      clientReleased = true;
      client.release();
      return res.json({ verified: true });
    } else {
      const attemptsCount = parseInt(sessionAtt[0].cnt) + 1;
      let needsManager = false;
      if (attemptsCount >= 3) {
        needsManager = true;
        await client.query(
          "UPDATE fueling_sessions SET metadata = COALESCE(metadata,'{}'::jsonb) || $2::jsonb WHERE id=$1",
          [session.id, JSON.stringify({ facial_failures: attemptsCount, needs_manager: true, last_failure_at: new Date().toISOString() })]
        );
      }
      
      await client.query("COMMIT");
      clientReleased = true;
      client.release();
      
      if (needsManager) {
        await security.recordSecurityEvent({
          truckId: session.truck_id,
          type: "facial_auth_locked",
          severity: "high",
          source: "app",
          payload: { session_id: session.id, attempt: attemptsCount, max_attempts: 3, driver_id: session.driver_id },
          io: req.io,
        });
      }

      return res.json({ verified: false, attempts: attemptsCount, remaining: Math.max(3 - attemptsCount, 0), error: providerResult.error });
    }
  } catch (err) {
    if (client && !clientReleased) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
    }
    console.error("Verify face error:", err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (client && !clientReleased) client.release();
  }
};`;

c = c.replace(/exports\.verifyFace = async \(req, res\) => \{[\s\S]*?(?=exports\.bleConfirmed =)/, newVerifyFace + '\n\n');

fs.writeFileSync('backend/src/controllers/fuelingController.js', c);
