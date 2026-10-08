const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const db = require('../config/db');
const { stringify } = require('csv-stringify');

async function getFuelingLogsForExport(queryReq) {
  const { truck_id, driver_id, start, end, dataSource, onlyDivergence } = queryReq;
  let query = `
    SELECT fl.id, 
           d.name as motorista, 
           t.plate as caminhao, 
           fl.timestamp, 
           fl.lat, 
           fl.lng, 
           fl.level_before, 
           fl.level_after, 
           fl.release_method,
           fl.data_source,
           fl.pump_liters,
           fl.tank_liters_delta,
           CASE 
             WHEN fl.pump_liters IS NOT NULL AND fl.tank_liters_delta IS NOT NULL AND fl.pump_liters > 0 
             THEN ABS(fl.pump_liters - fl.tank_liters_delta) 
             ELSE NULL 
           END as divergence_liters,
           CASE 
             WHEN fl.pump_liters IS NOT NULL AND fl.tank_liters_delta IS NOT NULL AND fl.pump_liters > 0 
             THEN (ABS(fl.pump_liters - fl.tank_liters_delta) / fl.pump_liters * 100)
             ELSE NULL 
           END as divergence_pct
    FROM fueling_logs fl
    LEFT JOIN drivers d ON fl.driver_id = d.id
    LEFT JOIN trucks t ON fl.truck_id = t.id
    WHERE 1=1
  `;
  const values = [];
  let idx = 1;
  if (truck_id)  { query += ` AND fl.truck_id = $${idx++}`;   values.push(truck_id); }
  if (driver_id) { query += ` AND fl.driver_id = $${idx++}`;  values.push(driver_id); }
  if (dataSource) { query += ` AND fl.data_source = $${idx++}`; values.push(dataSource); }
  if (onlyDivergence === 'true') {
    query += ` AND (
      fl.pump_liters IS NOT NULL AND fl.tank_liters_delta IS NOT NULL AND fl.pump_liters > 0 AND 
      ABS(fl.pump_liters - fl.tank_liters_delta) > 0
    )`;
  }
  if (start)     { query += ` AND fl.timestamp >= $${idx++}::date`; values.push(start); }
  if (end)       { query += ` AND fl.timestamp < ($${idx++}::date + INTERVAL '1 day')`; values.push(end); }
  
  query += " ORDER BY fl.timestamp DESC LIMIT 1000";
  const { rows } = await db.query(query, values);
  return rows;
}

exports.exportPDF = async (req, res) => {
  try {
    const logs = await getFuelingLogsForExport(req.query);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio_abastecimentos.pdf"');
    
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    doc.pipe(res);
    
    const brandColor = '#2FBEB5';
    const darkText = '#1f2e3b';
    const lightText = '#64748b';

    doc.fillColor(brandColor).fontSize(20).font('Helvetica-Bold').text('EHR Solutions', { align: 'left' });
    doc.fillColor(darkText).fontSize(14).text('Relatório Oficial de Abastecimentos', { align: 'left' });
    doc.moveDown(0.5);
    doc.fillColor(lightText).fontSize(10).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'left' });
    doc.moveDown(1.5);
    
    const colX = {
      date: 30,
      truck: 130,
      driver: 200,
      pump: 330,
      tank: 390,
      div: 450,
      source: 550,
      method: 640
    };
    
    const drawTableHeader = () => {
      doc.rect(30, doc.y, 780, 20).fill('#f1f5f9');
      doc.fillColor(darkText).font('Helvetica-Bold').fontSize(9);
      const rowY = doc.y + 6;
      doc.text('DATA / HORA', colX.date, rowY, { continued: false });
      doc.text('PLACA', colX.truck, rowY, { continued: false });
      doc.text('MOTORISTA', colX.driver, rowY, { continued: false });
      doc.text('BOMBA (L)', colX.pump, rowY, { continued: false });
      doc.text('TANQUE (L)', colX.tank, rowY, { continued: false });
      doc.text('DIVERGÊNCIA', colX.div, rowY, { continued: false });
      doc.text('ORIGEM', colX.source, rowY, { continued: false });
      doc.text('MÉTODO', colX.method, rowY, { continued: false });
      doc.moveDown(1.5);
    };

    drawTableHeader();
    
    doc.font('Helvetica').fontSize(8);
    let isZebra = false;
    
    for (const log of logs) {
      if (doc.y > 500) {
        doc.addPage();
        drawTableHeader();
        doc.font('Helvetica').fontSize(8);
      }
      
      const currentY = doc.y;
      if (isZebra) doc.rect(30, currentY - 4, 780, 18).fill('#fafafa');
      isZebra = !isZebra;

      const dt = new Date(log.timestamp).toLocaleString('pt-BR');
      const plate = log.caminhao || '-';
      const driver = (log.motorista || '-').substring(0, 20);
      const pump = log.pump_liters != null ? parseFloat(log.pump_liters).toFixed(1) : '-';
      const tank = log.tank_liters_delta != null ? parseFloat(log.tank_liters_delta).toFixed(1) : '-';
      const div = log.divergence_pct != null ? `${parseFloat(log.divergence_liters).toFixed(1)} L (${parseFloat(log.divergence_pct).toFixed(1)}%)` : '-';
      const source = log.data_source || 'legacy';
      const method = log.release_method || '-';
      
      doc.fillColor('#334155');
      doc.text(dt, colX.date, currentY, { width: 95 });
      doc.font('Helvetica-Bold').text(plate, colX.truck, currentY, { width: 65 });
      doc.font('Helvetica').text(driver, colX.driver, currentY, { width: 120 });
      doc.font('Helvetica-Bold').text(pump, colX.pump, currentY, { width: 55 });
      doc.font('Helvetica-Bold').text(tank, colX.tank, currentY, { width: 55 });
      
      if (log.divergence_pct != null && parseFloat(log.divergence_pct) > 5) doc.fillColor('#f87171');
      else doc.fillColor('#334155');
      
      doc.text(div, colX.div, currentY, { width: 95 });
      
      doc.fillColor('#64748b').font('Helvetica').text(source, colX.source, currentY, { width: 85 });
      doc.fillColor('#64748b').text(method, colX.method, currentY, { width: 85 });
      
      doc.moveDown(1);
    }
    
    doc.end();
  } catch (error) {
    console.error('Export PDF error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

exports.exportCSV = async (req, res) => {
  try {
    const logs = await getFuelingLogsForExport(req.query);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_abastecimentos.csv');
    
    const stringifier = stringify({
      header: true,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'motorista', header: 'Motorista' },
        { key: 'caminhao', header: 'Caminhão (placa)' },
        { key: 'timestamp', header: 'Data/Hora' },
        { key: 'pump_liters', header: 'Bomba (L)' },
        { key: 'tank_liters_delta', header: 'Tanque (L)' },
        { key: 'divergence_liters', header: 'Divergência (L)' },
        { key: 'divergence_pct', header: 'Divergência (%)' },
        { key: 'data_source', header: 'Origem do Dado' },
        { key: 'release_method', header: 'Método' }
      ]
    });
    
    stringifier.pipe(res);
    logs.forEach(row => stringifier.write(row));
    stringifier.end();
  } catch (error) {
    console.error('Export CSV error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

