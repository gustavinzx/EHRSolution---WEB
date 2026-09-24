import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

export default function DriverModal({ isOpen, onClose, onSave, driver }) {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', truckPlate: '', truckModel: '', truckCapacity: '' });

  useEffect(() => {
    if (!isOpen) return;
    if (driver) {
      setFormData({
        name: driver.name || '',
        phone: driver.phone || '',
        email: driver.email || ''
      });
    } else {
      setFormData({ name: '', phone: '', email: '', truckPlate: '', truckModel: '', truckCapacity: '' });
    }
  }, [isOpen, driver]);

  if (!isOpen) return null;

  const inputStyle = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', padding: '12px 14px', borderRadius: '10px',
    width: '100%', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const focus = e => { e.target.style.borderColor='rgba(56,189,248,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(56,189,248,0.1)'; };
  const blur  = e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="driver-modal-title" style={{
        background: 'rgba(11,20,36,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
        width: '100%', maxWidth: '440px', padding: '24px',
        maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        position: 'relative',
      }}>
        {/* Close */}
        <button aria-label="Fechar detalhes do motorista" onClick={onClose} style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px',
          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <X size={16} />
        </button>

        <h2 id="driver-modal-title" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '6px', paddingRight: '40px' }}>
          {driver ? driver.name : 'Novo Motorista'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '28px' }}>
          {driver ? 'Atualize os dados cadastrais' : 'Preencha os dados para cadastrar'}
        </p>

        <form onSubmit={e => { e.preventDefault(); onSave({ name: formData.name, phone: formData.phone, email: formData.email, ...(!driver && formData.truckPlate && formData.truckModel ? { truck: { plate: formData.truckPlate, model: formData.truckModel, capacity_liters: formData.truckCapacity } } : {}) }); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { key: 'name',  label: 'Nome *',   type: 'text',  required: true,  placeholder: 'Nome completo' },
            { key: 'phone', label: 'Telefone', type: 'text',  required: false, placeholder: '(11) 99999-9999' },
            { key: 'email', label: 'E-mail',   type: 'email', required: false, placeholder: 'motorista@email.com' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor={`driver-${f.key}`} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {f.label}
              </label>
              <input
                id={`driver-${f.key}`}
                type={f.type} required={f.required} placeholder={f.placeholder}
                value={formData[f.key]}
                onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                style={inputStyle} onFocus={focus} onBlur={blur}
              />
            </div>
          ))}
          {!driver && <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: '16px', display: 'grid', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Caminhão próprio (opcional)</span>
            <input placeholder="Placa (ex.: ABC-1234)" value={formData.truckPlate} onChange={e => setFormData({ ...formData, truckPlate: e.target.value })} style={inputStyle} />
            <input placeholder="Modelo do caminhão" value={formData.truckModel} onChange={e => setFormData({ ...formData, truckModel: e.target.value })} style={inputStyle} />
            <input type="number" min="1" placeholder="Capacidade do tanque (L)" value={formData.truckCapacity} onChange={e => setFormData({ ...formData, truckCapacity: e.target.value })} style={inputStyle} />
          </div>}

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
              background: 'linear-gradient(135deg, #38BDF8, #60A5FA)',
              color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(56,189,248,0.3)',
            }}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
