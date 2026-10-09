const fs = require('fs');
let c = fs.readFileSync('backend/src/controllers/fuelingController.js', 'utf8');
c = c.replace(/if \(!session\.facial_verified_at\)/, `if (session.facial_consumed_at) return res.status(403).json({ error: "facial_verification_already_used" });
      if (!session.facial_verified_at)`);
fs.writeFileSync('backend/src/controllers/fuelingController.js', c);
