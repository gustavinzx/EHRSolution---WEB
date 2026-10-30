import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, Clock, Activity, ShieldCheck, Sliders } from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const glass = {
  background: 'rgba(11, 22, 40, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
  padding: '24px',
};

const inputStyle = {
  width: '100%',
  background: 'rgba(6, 11, 19, 0.7)',
  border: '1px solid rgba(0, 212, 255, 0.2)',
  color: '#e2e8f0',
  borderRadius: '10px',
  padding: '11px 14px',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '14px',
  outline: 'none',
  marginTop: '6px',
};

const labelStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#FFFFFF',
  display: 'block',
};

const helpStyle = {
  fontSize: '12px',
  color: '#8899A6',
  marginTop: '4px',
  lineHeight: 1.4,
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
    if (type === 'checkbox') {
      val = checked ? 1 : 0;
    } else if (type === 'number') {
      val = value === '' ? '' : value;
    }
    setSettings(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const divPct = parseFloat(settings.divergence_pct) || 0;
    const divCritPct = parseFloat(settings.divergence_critical_pct) || 0;

    if (divCritPct <= divPct) {
      toast.error('Divergência crítica deve ser MAIOR que a aceitável.');
      return;
    }

    const payload = {
      ...settings,
      divergence_pct: divPct,
      divergence_critical_pct: divCritPct,
      offhours_start_hour: parseInt(settings.offhours_start_hour, 10) || 0,
      offhours_end_hour: parseInt(settings.offhours_end_hour, 10) || 0,
    };

    try {
      setSaving(true);
      await client.put('/settings/alerts', payload);
      toast.success('Configurações salvas com sucesso!');
      setSettings(payload);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!settings) return null;

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
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
          <Sliders size={26} color="#00D4FF" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
            Configurações do Sistema
          </h1>
          <p style={{ margin: '4px 0 0', color: '#8899A6', fontSize: '13px' }}>
            Ajuste e calibre os limiares de sensibilidade do motor preditivo de detecção de anomalias.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={glass}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '10px', borderRadius: '10px' }}>
              <AlertTriangle size={20} color="#fbbf24" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>Divergência Bomba vs Tanque</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8899A6' }}>Comparação volumétrica entre totalizador da bomba e sensor telemétrico.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Tolerância Aceitável (%)</label>
              <input type="number" step="0.1" name="divergence_pct" value={settings.divergence_pct || ''} onChange={handleChange} style={inputStyle} required />
              <div style={helpStyle}>Diferença máxima normal aceita antes de disparar alerta High.</div>
            </div>
            <div>
              <label style={labelStyle}>Tolerância Crítica (%)</label>
              <input type="number" step="0.1" name="divergence_critical_pct" value={settings.divergence_critical_pct || ''} onChange={handleChange} style={inputStyle} required />
              <div style={helpStyle}>Divergência severa indicando possível furto ou vazamento (alerta Critical).</div>
            </div>
          </div>
        </div>
        
        <div style={glass}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(0, 212, 255, 0.12)', border: '1px solid rgba(0, 212, 255, 0.3)', padding: '10px', borderRadius: '10px' }}>
              <Clock size={20} color="#00D4FF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>Horários Noturnos Restritos</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8899A6' }}>Restrição de destravamento em janelas operacionais de risco.</p>
            </div>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', ...labelStyle }}>
              <input
                type="checkbox"
                name="offhours_enabled"
                checked={settings.offhours_enabled === 1}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', accentColor: '#00D4FF' }}
              />
              Gerar alertas para abastecimentos noturnos fora de turno
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

        <div style={glass}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(0, 245, 160, 0.12)', border: '1px solid rgba(0, 245, 160, 0.3)', padding: '10px', borderRadius: '10px' }}>
              <Activity size={20} color="#00F5A0" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>Consumo Anômalo por Km</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8899A6' }}>Variação de rendimento térmico do motor em rota.</p>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Desvio de Consumo Aceitável (%)</label>
            <input type="number" step="0.1" name="consumption_deviation_pct" value={settings.consumption_deviation_pct || ''} onChange={handleChange} style={inputStyle} required />
            <div style={helpStyle}>Variação permitida em relação à média histórica (km/L) antes de alertar a central.</div>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #0072FF)',
                color: '#fff',
                border: 'none',
                padding: '13px 28px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.35)',
              }}
            >
              <Save size={18} />
              {saving ? 'Salvando...' : 'Salvar Regras'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
