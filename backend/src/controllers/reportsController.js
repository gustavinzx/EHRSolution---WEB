
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const dataProvider = require('../services/fleetDataProvider');

exports.exportPDF = async (req, res) => {
  try {
    const { truck_id, driver_id, start, end } = req.query;
    const logs = await dataProvider.getFuelingLogs({ truck_id, driver_id, start, end });
    
    // Configura resposta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio_abastecimentos.pdf"');
    
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('EHR Solutions - Relatório de Abastecimentos', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.text(`Filtros: Caminhão: ${truck_id || 'Todos'} | Motorista: ${driver_id || 'Todos'} | Período: ${start || 'S/D'} a ${end || 'S/D'}`, { align: 'center' });
    doc.moveDown(2);
    
    // Configuração de Tabela
    const colX = {
      date: 40,
      truck: 110,
      driver: 170,
      gps: 260,
      qty: 360,
      method: 410,
      hash: 480
    };
    
    // Table Header
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Data/Hora', colX.date, doc.y, { continued: false });
    doc.text('Placa', colX.truck, doc.y - 10.5, { continued: false });
    doc.text('Motorista', colX.driver, doc.y - 10.5, { continued: false });
    doc.text('Localização (GPS)', colX.gps, doc.y - 10.5, { continued: false });
    doc.text('Abastecido', colX.qty, doc.y - 10.5, { continued: false });
    doc.text('Liberação', colX.method, doc.y - 10.5, { continued: false });
    doc.text('Carimbo (Integridade)', colX.hash, doc.y - 10.5, { continued: false });
    doc.moveTo(40, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();
    
    doc.font('Helvetica').fontSize(8);
    
    for (const log of logs) {
      if (doc.y > 750) {
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Data/Hora', colX.date, doc.y, { continued: false });
        doc.text('Placa', colX.truck, doc.y - 10.5, { continued: false });
        doc.text('Motorista', colX.driver, doc.y - 10.5, { continued: false });
        doc.text('Localização (GPS)', colX.gps, doc.y - 10.5, { continued: false });
        doc.text('Abastecido', colX.qty, doc.y - 10.5, { continued: false });
        doc.text('Liberação', colX.method, doc.y - 10.5, { continued: false });
        doc.text('Carimbo (Integridade)', colX.hash, doc.y - 10.5, { continued: false });
        doc.moveTo(40, doc.y + 5).lineTo(550, doc.y + 5).stroke();
        doc.moveDown();
        doc.font('Helvetica').fontSize(8);
      }
      
      const dt = new Date(log.timestamp).toLocaleString('pt-BR');
      const plate = log.truck_plate || '-';
      const driver = log.driver_name ? log.driver_name.substring(0, 15) : '-';
      const gps = `${Number(log.lat).toFixed(4)}, ${Number(log.lng).toFixed(4)}`;
      const qty = `+${Number(log.level_after) - Number(log.level_before)}L`;
      const method = log.release_method === 'facial' ? 'Facial' : 'BLE';
      
      // NOTA: Este hash é uma SIMULAÇÃO de integridade. Em um cenário real, 
      // uma infraestrutura de chaves públicas (PKI) ou blockchain seria utilizada.
      const rawData = `${log.timestamp}|${log.lat}|${log.lng}|${driver}|${log.level_before}|${log.level_after}`;
      const hash = crypto.createHash('sha256').update(rawData).digest('hex').substring(0, 12);
      
      const currentY = doc.y;
      doc.text(dt, colX.date, currentY, { width: 65 });
      doc.text(plate, colX.truck, currentY, { width: 55 });
      doc.text(driver, colX.driver, currentY, { width: 85 });
      doc.text(gps, colX.gps, currentY, { width: 95 });
      doc.text(qty, colX.qty, currentY, { width: 45 });
      doc.text(method, colX.method, currentY, { width: 65 });
      doc.font('Courier').text(hash, colX.hash, currentY, { width: 70 });
      doc.font('Helvetica');
      
      doc.moveDown(0.5);
    }
    
    doc.end();
  } catch (error) {
    console.error('Export PDF error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};
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
