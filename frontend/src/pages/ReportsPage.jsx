import React, { useState } from 'react';
import { useFleet } from '../hooks/useFleet';
import { useDrivers } from '../hooks/useDrivers';
import { Download, FileText, Calendar, Truck, Filter, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';

const glass = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px',
};

const inputStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', padding: '11px 14px', borderRadius: '10px',
  fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', width: '100%',
};

export default function ReportsPage() {
  const { trucks } = useFleet();
  const { drivers } = useDrivers();
  
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [onlyDivergence, setOnlyDivergence] = useState(false);
  const [start,   setStart]   = useState('');
  const [end,     setEnd]     = useState('');
  const [loading, setLoading] = useState(false);

  const getParams = () => {
    const params = new URLSearchParams();
    if (truckId) params.append('truck_id', truckId);
    if (driverId) params.append('driver_id', driverId);
    if (dataSource) params.append('dataSource', dataSource);
    if (onlyDivergence) params.append('onlyDivergence', 'true');
    if (start)   params.append('start', start);
    if (end)     params.append('end', end);
    return params;
  };

  const downloadBlob = (data, filename) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const handleExportCSV = async () => {
    setLoading(true);
    try {
      const res = await client.get('/reports/export', {
        params: getParams(),
        responseType: 'blob'
      });
      downloadBlob(res.data, 'relatorio_abastecimentos.csv');
      toast.success('CSV exportado!');
    } catch (err) {
      toast.error('Erro ao exportar CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const res = await client.get('/reports/export-pdf', {
        params: getParams(),
        responseType: 'blob'
      });
      downloadBlob(res.data, 'relatorio_abastecimentos.pdf');
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      toast.error('Erro ao exportar PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h1 style={{display:'flex', alignItems:'center', gap:'12px',  fontSize:'28px', fontFamily:'var(--font-display)', fontWeight:800, color:'#fff', margin:0 }}><FileText size={28} color="#2FBEB5" /> Relatórios</h1>
        <p style={{ color:'var(--text-muted)', fontSize:'13px', marginTop:'6px' }}>
          Exporte histórico de abastecimentos em CSV ou PDF oficial.
        </p>
      </div>

      <div style={{ ...glass, padding:'28px', maxWidth:'600px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' }}>
                <Truck size={11} style={{marginRight: 4}}/> Caminhão
              </label>
              <select value={truckId} onChange={e => setTruckId(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                <option value="" style={{background: '#1F2E3B', color: '#fff'}}>Todos os caminhões</option>
                {Array.isArray(trucks) && trucks.map(t => (
                  <option key={t.id} value={t.id} style={{background: '#1F2E3B', color: '#fff'}}>{t.plate}</option>
                ))}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' }}>
                <Truck size={11} style={{marginRight: 4}}/> Motorista
              </label>
              <select value={driverId} onChange={e => setDriverId(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                <option value="" style={{background: '#1F2E3B', color: '#fff'}}>Todos os motoristas</option>
                {Array.isArray(drivers) && drivers.map(d => (
                  <option key={d.id} value={d.id} style={{background: '#1F2E3B', color: '#fff'}}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' }}>
                <Calendar size={11} style={{marginRight: 4}}/> Data Inicial
              </label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' }}>
                <Calendar size={11} style={{marginRight: 4}}/> Data Final
              </label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>
          
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'12px', alignItems: 'end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' }}>
                <Filter size={11} style={{marginRight: 4}}/> Origem do Dado
              </label>
              <select value={dataSource} onChange={e => setDataSource(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                <option value="" style={{background: '#1F2E3B', color: '#fff'}}>Todas as origens</option>
                <option value="hardware" style={{background: '#1F2E3B', color: '#fff'}}>Hardware (Confirmado)</option>
                <option value="manager" style={{background: '#1F2E3B', color: '#fff'}}>Gestor (Manual)</option>
                <option value="unverified" style={{background: '#1F2E3B', color: '#fff'}}>Não Verificado (App)</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '38px', paddingBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyDivergence} onChange={e => setOnlyDivergence(e.target.checked)} />
                <ShieldAlert size={14} color="#F2A93B"/> Com divergência (bomba x tanque)
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <button
              onClick={handleExportCSV} disabled={loading}
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:'9px',
                padding:'13px', borderRadius:'10px', border:'none',
                background: loading ? 'rgba(56,189,248,0.4)' : 'linear-gradient(135deg,#2FBEB5,#4F8EF7)',
                color:'#fff', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow:'0 8px 32px rgba(56,189,248,0.25)',
              }}
            >
              <Download size={18}/> Exportar CSV
            </button>
            
            <button
              onClick={handleExportPDF} disabled={loading}
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:'9px',
                padding:'13px', borderRadius:'10px', border:'1px solid rgba(56,189,248,0.5)',
                background: 'rgba(56,189,248,0.05)',
                color:'var(--teal)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'14px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <FileText size={18}/> Exportar PDF Auditável
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
