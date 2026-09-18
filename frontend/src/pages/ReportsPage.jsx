import React, { useState } from 'react';
import { useFleet } from '../hooks/useFleet';
import { useFueling } from '../hooks/useFueling';
import { Download, FileText, Calendar, Truck } from 'lucide-react';
import client from '../api/client';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

const inputStyle = {
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', padding: '11px 14px', borderRadius: '10px',
  fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', width: '100%',
};

export default function ReportsPage() {
  const { trucks } = useFleet();
  const [truckId, setTruckId] = useState('');
  const [start,   setStart]   = useState('');
  const [end,     setEnd]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (truckId) params.append('truck_id', truckId);
      if (start)   params.append('start', start);
      if (end)     params.append('end', end);

      const res = await client.get(`/reports/export?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href = url;
      a.download = `ehr-relatorio-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao exportar relatório');
    } finally {
      setLoading(false);
    }
  };

  
  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (truckId) params.append('truck_id', truckId);
      if (start)   params.append('start', start);
      if (end)     params.append('end', end);

      const res = await client.get(`/reports/export-pdf?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href = url;
      a.download = `ehr-relatorio-${new Date().toISOString().slice(0,10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao exportar relatório PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{ fontSize:'28px', fontFamily:'var(--font-display)', fontWeight:800, color:'#fff', margin:0 }}>
          Relatórios
        </h1>
        <p style={{ color:'var(--text-muted)', fontSize:'13px', marginTop:'6px' }}>
          Exporte histórico de abastecimentos em CSV
        </p>
      </div>

      {/* Export card */}
      <div style={{ ...glass, padding:'28px', maxWidth:'600px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
          <div style={{
            width:'40px', height:'40px', borderRadius:'10px',
            background:'linear-gradient(135deg,#38BDF8,#60A5FA)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 16px rgba(56,189,248,0.3)',
          }}>
            <FileText size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'16px', color:'#fff' }}>
              Exportar CSV
            </div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
              Histórico por caminhão e período
            </div>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {/* Truck select */}
          <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
            <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'5px' }}>
              <Truck size={11}/> Caminhão
            </label>
            <select value={truckId} onChange={e => setTruckId(e.target.value)} style={{ ...inputStyle, appearance:'none', cursor:'pointer' }}>
              <option value="">Todos os caminhões</option>
              {Array.isArray(trucks) && trucks.map(t => (
                <option key={t.id} value={t.id}>{t.plate} — {t.model}</option>
              ))}
            </select>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'5px' }}>
                <Calendar size={11}/> Data Inicial
              </label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.8px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'5px' }}>
                <Calendar size={11}/> Data Final
              </label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <button
            onClick={handleExport} disabled={loading}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:'9px',
              padding:'13px', borderRadius:'10px', border:'none', marginTop:'8px',
              background: loading ? 'rgba(56,189,248,0.4)' : 'linear-gradient(135deg,#38BDF8,#60A5FA)',
              color:'#fff', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow:'0 8px 32px rgba(56,189,248,0.25)',
              transition:'opacity 0.2s',
            }}
          >
            <Download size={18}/> {loading ? 'Exportando...' : 'Exportar CSV'}
          </button>
          
          <button
            onClick={handleExportPDF} disabled={loading}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:'9px',
              padding:'13px', borderRadius:'10px', border:'1px solid rgba(56,189,248,0.5)', marginTop:'8px',
              background: 'transparent',
              color:'var(--teal)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition:'background 0.2s',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(56,189,248,0.1)'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            <FileText size={18}/> {loading ? 'Aguarde...' : 'Exportar PDF com Carimbo (Auditoria)'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ ...glass, padding:'20px', maxWidth:'600px' }}>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'14px', color:'#fff', marginBottom:'12px' }}>
          📋 O arquivo inclui
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {['ID do registro','Nome do motorista','Placa do caminhão','Data e hora do abastecimento','Coordenadas GPS','Nível antes e depois (litros)','Método de liberação (facial / BLE)'].map(item => (
            <div key={item} style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'13px', color:'var(--text-secondary)' }}>
              <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--teal)', flexShrink:0 }} />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
