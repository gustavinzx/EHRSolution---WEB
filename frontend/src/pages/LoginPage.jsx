import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight, Shield, Gauge, Bell } from 'lucide-react';

const features = [
  { icon: Gauge,  label: 'Telemetria e rastreamento em tempo real' },
  { icon: Shield, label: 'Liberação de abastecimento com biometria facial' },
  { icon: Bell,   label: 'Detecção de anomalias e alertas de segurança' },
];

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) navigate('/');
  };

  const inputStyle = {
    background: 'rgba(7, 13, 26, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: '13px 16px',
    borderRadius: '12px',
    width: '100%',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(0, 196, 208, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(11, 21, 35, 0.8) 0%, transparent 50%), #070d1a',
    }}>
      {/* Left: branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '60px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blur spots */}
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'rgba(0, 196, 208, 0.12)', filter: 'blur(50px)', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '-80px',
          width: '240px', height: '240px', borderRadius: '50%',
          background: 'rgba(0, 151, 167, 0.1)', filter: 'blur(40px)', pointerEvents: 'none'
        }} />

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '420px' }}>
          {/* Official Logo Container */}
          <div style={{
            width: '90px', height: '90px', borderRadius: '24px', margin: '0 auto 24px',
            background: 'rgba(0, 196, 208, 0.08)',
            border: '1px solid rgba(0, 196, 208, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 35px rgba(0, 196, 208, 0.25)',
          }}>
            <img
              src="/ehr-logo-official.png"
              alt="EHR Solutions"
              style={{ width: '64px', height: '64px', objectFit: 'contain' }}
            />
          </div>

          <h1 style={{
            fontSize: '38px', fontWeight: 800,
            color: '#fff', margin: '0 0 10px', lineHeight: 1.1,
            letterSpacing: '-0.5px'
          }}>
            EHR <span style={{ color: '#00C4D0' }}>Solutions</span>
          </h1>

          <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: 1.6, marginBottom: '36px' }}>
            Plataforma Inteligente de Gestão de Frotas e Telemetria
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            {features.map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 18px', borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: 'rgba(0, 196, 208, 0.12)',
                  border: '1px solid rgba(0, 196, 208, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={16} color="#00C4D0" />
                </div>
                <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div style={{
        width: '460px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 48px',
        background: 'rgba(11, 21, 35, 0.75)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 196, 208, 0.1)', border: '1px solid rgba(0, 196, 208, 0.25)', padding: '4px 10px', borderRadius: '20px', color: '#00C4D0', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Portal do Gestor
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            Acessar Painel
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Entre com suas credenciais autorizadas
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              E-mail
            </label>
            <input
              type="email" required autoComplete="email" placeholder="gestor@ehr.com"
              value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor='#00C4D0'; e.target.style.boxShadow='0 0 0 3px rgba(0, 196, 208, 0.15)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Senha
            </label>
            <input
              type="password" required autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor='#00C4D0'; e.target.style.boxShadow='0 0 0 3px rgba(0, 196, 208, 0.15)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '14px', borderRadius: '12px', border: 'none',
              background: loading ? 'rgba(0, 196, 208, 0.5)' : 'linear-gradient(135deg, #00C4D0 0%, #0097A7 100%)',
              color: '#fff', fontWeight: 700,
              fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 24px rgba(0, 196, 208, 0.35)',
              transition: 'all 0.2s',
              marginTop: '6px',
            }}
          >
            {loading ? 'Entrando...' : <><span>Entrar</span><ArrowRight size={16}/></>}
          </button>
        </form>

        {/* Demo hint - apenas em desenvolvimento */}
        {import.meta.env.DEV && (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowDemo(!showDemo)}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showDemo ? 'Ocultar credenciais de teste' : 'Mostrar credenciais de teste'}
            </button>
            {showDemo && (
              <div style={{
                marginTop: '12px', padding: '12px 16px',
                background: 'rgba(0, 196, 208, 0.06)',
                border: '1px solid rgba(0, 196, 208, 0.2)',
                borderRadius: '10px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'left'
              }}>
                <div style={{ fontWeight: 700, color: '#00C4D0', marginBottom: '4px' }}>🔑 Acesso Demo</div>
                <div>E-mail: gestor@ehr.com</div>
                <div>Senha: Demo@1234</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
