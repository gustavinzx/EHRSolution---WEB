const db = require('../config/db');
const { stringify } = require('csv-stringify');

exports.exportCSV = async (req, res) => {
  try {
    const { truck_id, start, end } = req.query;
    
    let query = `
      SELECT fl.id, 
             d.name as motorista, 
             t.plate as caminhao, 
             fl.timestamp, 
             fl.lat, 
             fl.lng, 
             fl.level_before, 
             fl.level_after, 
             fl.release_method
      FROM fueling_logs fl
      LEFT JOIN drivers d ON fl.driver_id = d.id
      LEFT JOIN trucks t ON fl.truck_id = t.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (truck_id) {
      query += ` AND fl.truck_id = $${paramIndex}`;
      queryParams.push(truck_id);
      paramIndex++;
    }
    
    if (start) {
      query += ` AND fl.timestamp >= $${paramIndex}`;
      queryParams.push(start);
      paramIndex++;
    }
    
    if (end) {
      query += ` AND fl.timestamp <= $${paramIndex}`;
      queryParams.push(end);
      paramIndex++;
    }
    
    query += ` ORDER BY fl.timestamp DESC`;
    
    const result = await db.query(query, queryParams);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio.csv');
    
    const stringifier = stringify({
      header: true,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'motorista', header: 'Motorista' },
        { key: 'caminhao', header: 'Caminhão (placa)' },
        { key: 'timestamp', header: 'Timestamp' },
        { key: 'lat', header: 'Latitude' },
        { key: 'lng', header: 'Longitude' },
        { key: 'level_before', header: 'Nível Antes (L)' },
        { key: 'level_after', header: 'Nível Depois (L)' },
        { key: 'release_method', header: 'Método' }
      ]
    });
    
    stringifier.pipe(res);
    
    result.rows.forEach(row => {
      stringifier.write(row);
    });
    
    stringifier.end();
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
