import React, { useState } from 'react';
import { X, Truck, Fuel, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewTruckModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    plate: '',
    model: '',
    capacity_liters: '500',
    current_level_liters: '500',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const inputStyle = {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '12px 14px',
    borderRadius: '10px',
    width: '100%',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const focus = e => {
    e.target.style.borderColor = 'rgba(47,190,181,0.6)';
    e.target.style.boxShadow = '0 0 0 3px rgba(47,190,181,0.15)';
  };
  const blur = e => {
    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
    e.target.style.boxShadow = 'none';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.plate.trim() || !formData.model.trim()) {
      toast.error('Informe a placa e o modelo do caminhão.');
      return;
    }
    const cap = parseFloat(formData.capacity_liters);
    if (isNaN(cap) || cap <= 0) {
      toast.error('Capacidade deve ser um número positivo.');
      return;
    }

    setLoading(true);
    try {
      const res = await onSave({
        plate: formData.plate.trim().toUpperCase(),
        model: formData.model.trim(),
        capacity_liters: cap,
        current_level_liters: parseFloat(formData.current_level_liters) || cap,
      });
      if (res?.ok !== false) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'rgba(11,20,36,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
        width: '100%', maxWidth: '440px', padding: '28px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)', position: 'relative',
      }}>
        {/* Close Button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px',
          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-muted, #8BA3BC)',
        }}>
          <X size={16} />
        </button>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '6px', paddingRight: '40px' }}>
          Cadastrar Novo Caminhão
        </h2>
        <p style={{ color: 'var(--text-muted, #8BA3BC)', fontSize: '13px', marginBottom: '22px' }}>
          Adicione um veículo à frota para monitoramento e abastecimento
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Placa */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={13} color="#2FBEB5" /> Placa do Veículo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: ABC1D23 ou BRA2E19"
              value={formData.plate}
              onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
              style={inputStyle}
              onFocus={focus}
              onBlur={blur}
            />
          </div>

          {/* Modelo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Modelo / Fabricante *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Scania R450, Volvo FH 540..."
              value={formData.model}
              onChange={e => setFormData({ ...formData, model: e.target.value })}
              style={inputStyle}
              onFocus={focus}
              onBlur={blur}
            />
          </div>

          {/* Grid Capacidade & Nível */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Fuel size={13} color="#2FBEB5" /> Capacidade (L) *
              </label>
              <input
                type="number"
                required
                placeholder="500"
                value={formData.capacity_liters}
                onChange={e => setFormData({ ...formData, capacity_liters: e.target.value })}
                style={inputStyle}
                onFocus={focus}
                onBlur={blur}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Nível Inicial (L)
              </label>
              <input
                type="number"
                placeholder="500"
                value={formData.current_level_liters}
                onChange={e => setFormData({ ...formData, current_level_liters: e.target.value })}
                style={inputStyle}
                onFocus={focus}
                onBlur={blur}
              />
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary, #94a3b8)',
              fontFamily: 'var(--font-display, Inter)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
              color: '#fff', fontFamily: 'var(--font-display, Inter)', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,190,181,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}>
              <Check size={16} /> {loading ? 'Cadastrando...' : 'Cadastrar Caminhão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
