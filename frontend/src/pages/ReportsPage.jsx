import React, { useState } from 'react';
import { useFleet } from '../hooks/useFleet';
import { useDrivers } from '../hooks/useDrivers';
import { Download, FileText, Calendar, Truck, Filter, ShieldAlert, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';

const glass = {
  background: 'rgba(11, 22, 40, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
};

const inputStyle = {
  background: 'rgba(6, 11, 19, 0.7)',
  border: '1px solid rgba(0, 212, 255, 0.2)',
  color: '#fff',
  padding: '11px 14px',
  borderRadius: '10px',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  width: '100%',
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
      toast.success('CSV exportado com sucesso!');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{
        ...glass,
        padding: '26px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(6, 11, 19, 0.95) 0%, rgba(13, 25, 43, 0.95) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.22)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 114, 255, 0.2))',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.25)',
        }}>
          <FileText size={26} color="#00D4FF" />
        </div>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
            Relatórios e Auditoria Forense
          </h1>
          <p style={{ color: '#8899A6', fontSize: '13px', marginTop: '4px', margin: '4px 0 0' }}>
            Exporte registros de abastecimento, telemetria e conciliação em planilhas ou PDF oficial.
          </p>
        </div>
      </div>

      <div style={{ ...glass, padding: '32px', background: 'rgba(11, 22, 40, 0.85)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <Truck size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} color="#00D4FF" /> Veículo da Frota
              </label>
              <select value={truckId} onChange={e => setTruckId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="" style={{ background: '#0B1628', color: '#fff' }}>Todos os caminhões</option>
                {Array.isArray(trucks) && trucks.map(t => (
                  <option key={t.id} value={t.id} style={{ background: '#0B1628', color: '#fff' }}>{t.plate} - {t.model}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <Truck size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} color="#00D4FF" /> Motorista Condutor
              </label>
              <select value={driverId} onChange={e => setDriverId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="" style={{ background: '#0B1628', color: '#fff' }}>Todos os condutores</option>
                {Array.isArray(drivers) && drivers.map(d => (
                  <option key={d.id} value={d.id} style={{ background: '#0B1628', color: '#fff' }}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <Calendar size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} color="#00D4FF" /> Data Inicial
              </label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <Calendar size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} color="#00D4FF" /> Data Final
              </label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <Filter size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} color="#00D4FF" /> Origem do Dado
              </label>
              <select value={dataSource} onChange={e => setDataSource(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="" style={{ background: '#0B1628', color: '#fff' }}>Todas as origens</option>
                <option value="hardware" style={{ background: '#0B1628', color: '#fff' }}>Hardware IoT (Confirmado)</option>
                <option value="manager" style={{ background: '#0B1628', color: '#fff' }}>Gestor (Manual)</option>
                <option value="unverified" style={{ background: '#0B1628', color: '#fff' }}>Não Verificado (App)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', height: '42px', paddingBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={onlyDivergence}
                  onChange={e => setOnlyDivergence(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#00D4FF', cursor: 'pointer' }}
                />
                <ShieldAlert size={15} color="#fbbf24"/> Somente com divergência (&gt;5%)
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <button
              onClick={handleExportCSV}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px', borderRadius: '12px', border: 'none',
                background: loading ? 'rgba(0, 212, 255, 0.4)' : 'linear-gradient(135deg, #00D4FF, #0072FF)',
                color: '#fff', fontWeight: 800, fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <FileSpreadsheet size={18} /> Exportar Planilha CSV
            </button>
            
            <button
              onClick={handleExportPDF}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px', borderRadius: '12px', border: '1px solid rgba(0, 212, 255, 0.4)',
                background: 'rgba(0, 212, 255, 0.1)',
                color: '#00D4FF', fontWeight: 800, fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              <FileText size={18} /> Exportar Laudo PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
