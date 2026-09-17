const db = require("../config/db");

// Haversine em km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

exports.list = async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM fuel_stations WHERE active = true ORDER BY name");
    res.json(rows);
  } catch (err) {
    console.error("List stations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, brand, address, lat, lng } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ error: "name, lat e lng sao obrigatorios" });
    const { rows } = await db.query(
      "INSERT INTO fuel_stations (name, brand, address, lat, lng, source) VALUES ($1,$2,$3,$4,$5,'manual') RETURNING *",
      [name, brand||null, address||null, lat, lng]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Create station error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.nearest = async (req, res) => {
  try {
    const { lat, lng, radius_km = 200 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat e lng sao obrigatorios" });
    
    const { rows } = await db.query("SELECT * FROM fuel_stations WHERE active = true");
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    
    const withDist = rows.map(s => ({
      ...s,
      distance_km: haversineKm(userLat, userLng, parseFloat(s.lat), parseFloat(s.lng))
    })).filter(s => s.distance_km <= parseFloat(radius_km))
       .sort((a, b) => a.distance_km - b.distance_km);
    
    res.json(withDist.slice(0, 10));
  } catch (err) {
    console.error("Nearest station error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
