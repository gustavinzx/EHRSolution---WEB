const db = require('./backend/src/config/db');
const { getFuelingLogsForExport } = require('./backend/src/controllers/reportsController');
const fs = require('fs');
const PDFDocument = require('pdfkit');

async function run() {
  const req = { query: {} };
  
  // mock the db query to return test data
  const originalQuery = db.query;
  db.query = async (text, values) => {
    return {
      rows: [
        {
          id: 1, driver_name: 'Motorista de Teste Longo e Complicado', plate: 'ABC-1234', timestamp: '2023-01-01T10:00:00Z',
          lat: -23, lng: -46, data_source: 'hardware', pump_liters: 100, tank_liters_delta: 97,
          divergence_liters: 3, divergence_pct: 3, release_method: 'facial'
        },
        {
          id: 2, driver_name: 'Motorista 2', plate: 'DEF-5678', timestamp: '2023-01-01T11:00:00Z',
          lat: null, lng: null, data_source: 'unverified', pump_liters: null, tank_liters_delta: null,
          divergence_liters: null, divergence_pct: null, release_method: 'ble_fallback'
        },
        {
          id: 3, driver_name: 'Motorista 3', plate: 'GHI-9012', timestamp: '2023-01-01T12:00:00Z',
          lat: -23, lng: -46, data_source: 'manager', pump_liters: 100, tank_liters_delta: 90,
          divergence_liters: 10, divergence_pct: 10, release_method: 'manager_override'
        },
        {
          id: 4, driver_name: 'João', plate: 'JKL-3456', timestamp: '2023-01-01T13:00:00Z',
          lat: -23, lng: -46, data_source: 'legacy', pump_liters: 1000, tank_liters_delta: 800,
          divergence_liters: 200, divergence_pct: 20, release_method: 'manager_override'
        }
      ]
    };
  };

  const logs = await require('./backend/src/controllers/reportsController').__get__ ? 
               require('./backend/src/controllers/reportsController').__get__('getFuelingLogsForExport')(req.query) :
               await db.query().then(r => r.rows);
               
  // just copy the PDF logic
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  doc.pipe(fs.createWriteStream('test_report.pdf'));
  
    const brandColor = '#2fbeb5';
    const darkText = '#1f2e3b';
    const lightText = '#64748b';

    doc.fillColor(brandColor).fontSize(20).font('Helvetica-Bold').text('EHR Solutions', { align: 'left' });
    doc.fillColor(darkText).fontSize(14).text('Relatório Oficial de Abastecimentos', { align: 'left' });
    doc.moveDown(0.5);
    doc.fillColor(lightText).fontSize(10).font('Helvetica').text(Gerado em: novo, { align: 'left' });
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
    
    // We map the mock db rows to what getFuelingLogsForExport outputs
    const mappedLogs = logs.map(r => ({
      motorista: r.driver_name,
      caminhao: r.plate,
      timestamp: r.timestamp,
      pump_liters: r.pump_liters,
      tank_liters_delta: r.tank_liters_delta,
      divergence_liters: r.divergence_liters,
      divergence_pct: r.divergence_pct,
      data_source: r.data_source,
      release_method: r.release_method
    }));
    
    for (const log of mappedLogs) {
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
      const div = log.divergence_pct != null ? ${parseFloat(log.divergence_liters).toFixed(1)} L (%) : '-';
      const source = log.data_source || 'legacy';
      const method = log.release_method || '-';
      
      doc.fillColor('#334155');
      doc.text(dt, colX.date, currentY, { width: 95 });
      doc.font('Helvetica-Bold').text(plate, colX.truck, currentY, { width: 65 });
      doc.font('Helvetica').text(driver, colX.driver, currentY, { width: 120 });
      doc.font('Helvetica-Bold').text(pump, colX.pump, currentY, { width: 55 });
      doc.text(tank, colX.tank, currentY, { width: 55 });
      
      if (log.divergence_pct > 15) doc.fillColor('#ef4444');
      else if (log.divergence_pct > 5) doc.fillColor('#f59e0b');
      
      doc.text(div, colX.div, currentY, { width: 95 });
      doc.fillColor('#64748b').font('Helvetica');
      doc.text(source, colX.source, currentY, { width: 85 });
      doc.text(method, colX.method, currentY, { width: 100 });
      doc.moveDown(1);
    }
    
    doc.end();
}

run();
