import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight, Shield, Gauge, Bell, Radio } from 'lucide-react';

const features = [
  { icon: Gauge,  label: 'Telemetria telemática contínua e rastreamento em tempo real' },
  { icon: Shield, label: 'Liberação física de bocal com biometria facial e IA liveness' },
  { icon: Bell,   label: 'Detecção de divergência volumétrica e auditoria ANP' },
];

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
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
    background: 'rgba(6, 11, 19, 0.75)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
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
      background: 'radial-gradient(ellipse at 15% 50%, rgba(0, 212, 255, 0.12) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(0, 114, 255, 0.12) 0%, transparent 55%), #060B13',
    }}>
      {/* Left: branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '60px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blur spots */}
        <div style={{
          position: 'absolute', top: '-100px', left: '-100px',
          width: '360px', height: '360px', borderRadius: '50%',
          background: 'rgba(0, 212, 255, 0.14)', filter: 'blur(60px)', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '-80px',
          width: '280px', height: '280px', borderRadius: '50%',
          background: 'rgba(0, 114, 255, 0.12)', filter: 'blur(50px)', pointerEvents: 'none'
        }} />

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '440px' }}>
          {/* Official Logo Container */}
          <div style={{
            width: '92px', height: '92px', borderRadius: '24px', margin: '0 auto 24px',
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 114, 255, 0.2))',
            border: '1.5px solid rgba(0, 212, 255, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 35px rgba(0, 212, 255, 0.35)',
          }}>
            <img
              src="/ehr-logo-official.png"
              alt="EHR Solutions"
              style={{ width: '64px', height: '64px', objectFit: 'contain' }}
            />
          </div>

          <h1 style={{
            fontSize: '40px', fontWeight: 900,
            color: '#fff', margin: '0 0 10px', lineHeight: 1.1,
            letterSpacing: '-0.5px'
          }}>
            EHR <span style={{ color: '#00D4FF', textShadow: '0 0 20px rgba(0, 212, 255, 0.5)' }}>Solutions</span>
          </h1>

          <p style={{ color: '#8899A6', fontSize: '15px', lineHeight: 1.6, marginBottom: '36px' }}>
            Plataforma Next-Gen de Gestão de Frotas, Telemetria IoT e Segurança Forense
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            {features.map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 18px', borderRadius: '14px',
                background: 'rgba(11, 22, 40, 0.75)',
                border: '1px solid rgba(0, 212, 255, 0.15)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(0, 212, 255, 0.12)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={18} color="#00D4FF" />
                </div>
                <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>{label}</span>
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
        background: 'rgba(11, 22, 40, 0.88)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderLeft: '1px solid rgba(0, 212, 255, 0.18)',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 212, 255, 0.12)', border: '1px solid rgba(0, 212, 255, 0.3)', padding: '5px 12px', borderRadius: '20px', color: '#00D4FF', fontSize: '11px', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '14px', boxShadow: '0 0 12px rgba(0, 212, 255, 0.2)' }}>
            <Radio size={12} color="#00D4FF" /> Portal do Gestor
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '6px', letterSpacing: '-0.3px' }}>
            Acessar Painel
          </h2>
          <p style={{ color: '#8899A6', fontSize: '14px', margin: 0 }}>
            Entre com suas credenciais autorizadas de comando
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              E-mail
            </label>
            <input
              type="email" required autoComplete="email" placeholder="seu.email@empresa.com"
              value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor='#00D4FF'; e.target.style.boxShadow='0 0 16px rgba(0, 212, 255, 0.25)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(0, 212, 255, 0.2)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              Senha
            </label>
            <input
              type="password" required autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor='#00D4FF'; e.target.style.boxShadow='0 0 16px rgba(0, 212, 255, 0.25)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(0, 212, 255, 0.2)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '14px', borderRadius: '12px', border: 'none',
              background: loading ? 'rgba(0, 212, 255, 0.4)' : 'linear-gradient(135deg, #00D4FF 0%, #0072FF 100%)',
              color: '#fff', fontWeight: 800,
              fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 24px rgba(0, 212, 255, 0.4)',
              transition: 'all 0.2s',
              marginTop: '6px',
            }}
          >
            {loading ? 'Entrando...' : <><span>Entrar</span><ArrowRight size={16}/></>}
          </button>
        </form>
      </div>
    </div>
  );
}
