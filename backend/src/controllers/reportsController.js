
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
    
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    
    // Config de cores e fontes
    const brandColor = '#2FBEB5';
    const darkText = '#1f2e3b';
    const lightText = '#64748b';

    // Header
    doc.fillColor(brandColor).fontSize(24).font('Helvetica-Bold').text('EHR Solutions', { align: 'left' });
    doc.fillColor(darkText).fontSize(14).text('Relatório Oficial de Abastecimentos', { align: 'left' });
    doc.moveDown(0.5);
    doc.fillColor(lightText).fontSize(10).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'left' });
    
    // Linha de filtro
    let filtrosTexto = [];
    if (truck_id) filtrosTexto.push(`Veículo ID: ${truck_id}`);
    if (driver_id) filtrosTexto.push(`Motorista ID: ${driver_id}`);
    if (start || end) filtrosTexto.push(`Período: ${start || '-'} até ${end || '-'}`);
    
    if (filtrosTexto.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(9).text(`Filtros Aplicados: ${filtrosTexto.join(' | ')}`);
    }

    doc.moveDown(2);
    
    // Configuração de Tabela
    const colX = {
      date: 50,
      truck: 130,
      driver: 190,
      qty: 290,
      method: 360,
      hash: 440
    };
    
    const drawTableHeader = () => {
      doc.rect(50, doc.y, 495, 20).fill('#f1f5f9');
      doc.fillColor(darkText).font('Helvetica-Bold').fontSize(9);
      const rowY = doc.y + 6;
      doc.text('DATA / HORA', colX.date, rowY, { continued: false });
      doc.text('PLACA', colX.truck, rowY, { continued: false });
      doc.text('MOTORISTA', colX.driver, rowY, { continued: false });
      doc.text('VOLUME (L)', colX.qty, rowY, { continued: false });
      doc.text('MÉTODO', colX.method, rowY, { continued: false });
      doc.text('ASSINATURA DIGITAL', colX.hash, rowY, { continued: false });
      doc.moveDown(1.5);
    };

    drawTableHeader();
    
    doc.font('Helvetica').fontSize(8);
    let isZebra = false;
    
    for (const log of logs) {
      if (doc.y > 750) {
        doc.addPage();
        drawTableHeader();
        doc.font('Helvetica').fontSize(8);
      }
      
      const currentY = doc.y;
      
      if (isZebra) {
        doc.rect(50, currentY - 4, 495, 18).fill('#fafafa');
      }
      isZebra = !isZebra;

      const dt = new Date(log.timestamp).toLocaleString('pt-BR');
      const plate = log.truck_plate || log.caminhao || '-'; // lidando com aliases
      const driver = (log.driver_name || log.motorista || '-').substring(0, 16);
      
      const vBefore = Number(log.level_before) || 0;
      const vAfter = Number(log.level_after) || 0;
      const qty = `+${(vAfter - vBefore).toFixed(1)} L`;
      
      const methodMap = { facial: 'Facial', ble_fallback: 'BLE/App', manager_override: 'Gestor' };
      const method = methodMap[log.release_method] || log.release_method || '-';
      
      const rawData = `${log.timestamp}|${log.lat}|${log.lng}|${driver}|${vBefore}|${vAfter}`;
      const hash = crypto.createHash('sha256').update(rawData).digest('hex').substring(0, 12).toUpperCase();
      
      doc.fillColor('#334155');
      doc.text(dt, colX.date, currentY, { width: 75 });
      doc.font('Helvetica-Bold').text(plate, colX.truck, currentY, { width: 55 });
      doc.font('Helvetica').text(driver, colX.driver, currentY, { width: 95 });
      doc.fillColor(brandColor).font('Helvetica-Bold').text(qty, colX.qty, currentY, { width: 65 });
      doc.fillColor('#334155').font('Helvetica').text(method, colX.method, currentY, { width: 75 });
      doc.fillColor('#94a3b8').font('Courier').text(hash, colX.hash, currentY, { width: 100 });
      
      doc.moveDown(1);
    }
    
    // Resumo no final
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).strokeColor('#e2e8f0').stroke();
    doc.moveDown(1);
    
    const totalVolume = logs.reduce((acc, log) => {
      const vBefore = Number(log.level_before) || 0;
      const vAfter = Number(log.level_after) || 0;
      return acc + (vAfter - vBefore);
    }, 0);

    doc.fillColor(darkText).font('Helvetica-Bold').fontSize(11)
       .text(`Total de Abastecimentos: ${logs.length}`, 50, doc.y);
    doc.text(`Volume Total Abastecido: ${totalVolume.toFixed(1)} Litros`, 50, doc.y + 15);
    
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
