import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function DriverModal({ isOpen, onClose, onSave, driver }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    setForm(driver ? { name: driver.name||'', phone: driver.phone||'', email: driver.email||'' } : { name:'', phone:'', email:'' });
  }, [driver, isOpen]);

  if (!isOpen) return null;

  const inputStyle = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', padding: '12px 14px', borderRadius: '10px',
    width: '100%', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const focus = e => { e.target.style.borderColor='rgba(47,190,181,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(47,190,181,0.1)'; };
  const blur  = e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'rgba(11,20,36,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
        width: '100%', maxWidth: '440px', padding: '32px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        position: 'relative',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px',
          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <X size={16} />
        </button>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
          {driver ? 'Editar Motorista' : 'Novo Motorista'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '28px' }}>
          {driver ? 'Atualize os dados do motorista' : 'Preencha os dados para cadastrar'}
        </p>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { key: 'name',  label: 'Nome *',   type: 'text',  required: true,  placeholder: 'Nome completo' },
            { key: 'phone', label: 'Telefone', type: 'text',  required: false, placeholder: '(11) 99999-9999' },
            { key: 'email', label: 'E-mail',   type: 'email', required: false, placeholder: 'motorista@email.com' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {f.label}
              </label>
              <input
                type={f.type} required={f.required} placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={inputStyle} onFocus={focus} onBlur={blur}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
              color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,190,181,0.3)',
            }}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
