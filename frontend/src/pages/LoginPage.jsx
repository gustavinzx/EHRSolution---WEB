import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight, Shield, Gauge, Bell } from 'lucide-react';

const features = [
  { icon: Gauge,  label: 'Monitoramento em tempo real' },
  { icon: Shield, label: 'Controle seguro de abastecimento' },
  { icon: Bell,   label: 'Alertas de combustível crítico' },
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

  const input = {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '13px 16px',
    borderRadius: '10px',
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
      background: 'radial-gradient(ellipse at 20% 50%, rgba(47,190,181,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(79,142,247,0.08) 0%, transparent 50%), #070d1a',
    }}>
      {/* Left: branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '60px', position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circles */}
        {[['-100px','-100px','300px','rgba(47,190,181,0.08)'],[null,'-80px','200px','rgba(79,142,247,0.1)',0,'60%']].map(([t,l,s,bg,b,r],i) => (
          <div key={i} style={{
            position:'absolute', top: i===0?'-60px':'auto', bottom: i===1?'-60px':'auto',
            left: i===0?'-60px':'auto', right: i===1?'-60px':'auto',
            width: s, height: s, borderRadius:'50%', background: bg, filter:'blur(40px)', pointerEvents:'none',
          }}/>
        ))}

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '400px' }}>
          {/* Logo */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '20px', margin: '0 auto 28px',
            background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(47,190,181,0.4)',
          }}>
            <img src="/images/ehr-logo.webp" alt="" style={{ width: '60px', height: '60px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>

          <h1 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: '40px', fontWeight: 800,
            color: '#fff', margin: '0 0 12px', lineHeight: 1.1,
          }}>
            EHR <span style={{ background: 'linear-gradient(135deg,#2FBEB5,#4F8EF7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Solutions</span>
          </h1>

          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '40px' }}>
            Plataforma Inteligente de<br />Controle de Frotas
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            {features.map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'linear-gradient(135deg,#2FBEB5,#4F8EF7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={15} color="#fff" />
                </div>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div style={{
        width: '440px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 48px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ marginBottom: '36px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            Acessar Painel
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Entre com suas credenciais de gestor
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              E-mail
            </label>
            <input
              type="email" required autoComplete="email" placeholder="gestor@ehr.com"
              value={email} onChange={e => setEmail(e.target.value)}
              style={input}
              onFocus={e => { e.target.style.borderColor='rgba(47,190,181,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(47,190,181,0.1)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Senha
            </label>
            <input
              type="password" required autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              style={input}
              onFocus={e => { e.target.style.borderColor='rgba(47,190,181,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(47,190,181,0.1)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '14px', borderRadius: '10px', border: 'none',
              background: loading ? 'rgba(47,190,181,0.5)' : 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
              color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700,
              fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 32px rgba(47,190,181,0.3)',
              transition: 'opacity 0.2s, transform 0.1s',
              marginTop: '8px',
            }}
          >
            {loading ? 'Entrando...' : <><span>Entrar</span><ArrowRight size={16}/></>}
          </button>
        </form>

        {/* Demo hint */}
        <div style={{
          marginTop: '32px', padding: '14px 16px',
          background: 'rgba(47,190,181,0.06)',
          border: '1px solid rgba(47,190,181,0.15)',
          borderRadius: '10px', fontSize: '12px', color: '#64748b', lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, color: '#2FBEB5', marginBottom: '4px' }}>🔑 Acesso Demo</div>
          <div>gestor@ehr.com</div>
          <div>Demo@1234</div>
        </div>
      </div>
    </div>
  );
}
