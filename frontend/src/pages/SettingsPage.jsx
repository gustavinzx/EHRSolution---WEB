import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, Clock, Activity, ShieldCheck } from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  padding: '24px',
};

const inputStyle = {
  width: '100%',
  background: '#111D27',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0',
  borderRadius: '8px',
  padding: '10px 14px',
  fontFamily: 'monospace',
  fontSize: '14px',
  outline: 'none',
  marginTop: '6px'
};

const labelStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#e2e8f0',
  display: 'block'
};

const helpStyle = {
  fontSize: '12px',
  color: '#64748b',
  marginTop: '4px'
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [resSet, resHist] = await Promise.all([
        client.get('/settings/alerts'),
        client.get('/settings/alerts/history')
      ]);
      setSettings(resSet.data);
      setHistory(resHist.data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = value;
    if (type === 'checkbox') val = checked ? 1 : 0;
    else if (type === 'number') val = parseFloat(value);
    setSettings(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (settings.divergence_critical_pct <= settings.divergence_pct) {
      toast.error('Divergência crítica deve ser MAIOR que a aceitável.');
      return;
    }
    try {
      setSaving(true);
      await client.put('/settings/alerts', settings);
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!settings) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#fff' }}>Configurações do Sistema</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>Ajuste as regras do motor de detecção de anomalias.</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(242,169,59,0.1)', padding: '8px', borderRadius: '8px' }}>
              <AlertTriangle size={20} color="#F2A93B" />
            </div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Divergência Bomba vs Tanque</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Tolerância Aceitável (%)</label>
              <input type="number" step="0.1" name="divergence_pct" value={settings.divergence_pct || ''} onChange={handleChange} style={inputStyle} required />
              <div style={helpStyle}>Diferença máxima permitida entre o abastecimento medido pela bomba e a leitura do sensor do caminhão. (Gera alerta High)</div>
            </div>
            <div>
              <label style={labelStyle}>Tolerância Crítica (%)</label>
              <input type="number" step="0.1" name="divergence_critical_pct" value={settings.divergence_critical_pct || ''} onChange={handleChange} style={inputStyle} required />
              <div style={helpStyle}>Divergência extrema que indica possível desvio de combustível. (Gera alerta Critical)</div>
            </div>
          </div>
        </div>
        
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(47,190,181,0.1)', padding: '8px', borderRadius: '8px' }}>
              <Clock size={20} color="#2FBEB5" />
            </div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Horários Restritos</h2>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', ...labelStyle }}>
              <input type="checkbox" name="offhours_enabled" checked={settings.offhours_enabled === 1} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              Gerar alertas para abastecimentos noturnos
            </label>
          </div>

          {settings.offhours_enabled === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Hora Inicial (0-23)</label>
                <input type="number" min="0" max="23" name="offhours_start_hour" value={settings.offhours_start_hour ?? ''} onChange={handleChange} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Hora Final (0-23)</label>
                <input type="number" min="0" max="23" name="offhours_end_hour" value={settings.offhours_end_hour ?? ''} onChange={handleChange} style={inputStyle} required />
              </div>
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(95,191,119,0.1)', padding: '8px', borderRadius: '8px' }}>
              <Activity size={20} color="#5FBF77" />
            </div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Consumo Anômalo</h2>
          </div>
          <div>
            <label style={labelStyle}>Desvio de Consumo Aceitável (%)</label>
            <input type="number" step="0.1" name="consumption_deviation_pct" value={settings.consumption_deviation_pct || ''} onChange={handleChange} style={inputStyle} required />
            <div style={helpStyle}>Variação permitida em relação à média histórica (km/L) do veículo antes de disparar alerta.</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
            <Save size={18} />
            {saving ? 'Salvando...' : 'Salvar Regras'}
          </button>
        </div>
      </form>
    </div>
  );
}








