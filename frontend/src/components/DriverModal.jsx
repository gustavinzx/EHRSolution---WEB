import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Truck, Mail, Phone, User, PlusCircle, CheckSquare, Square, ShieldCheck, Key, Copy, Check } from 'lucide-react';

const EMPTY_TRUCKS = [];

export default function DriverModal({ isOpen, onClose, onSave, driver, trucks = EMPTY_TRUCKS }) {
  const [temporaryPassword, setTemporaryPassword] = useState(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    truckMode: 'existing', // 'existing' | 'new' | 'none'
    truck_id: '',
    newTruckPlate: '',
    newTruckModel: '',
    newTruckCapacity: '500',
    autoEnrollFace: false,
  });

  const prevIsOpenRef = useRef(false);
  const prevDriverIdRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      prevDriverIdRef.current = null;
      return;
    }

    const justOpened = !prevIsOpenRef.current;
    const driverChanged = (driver?.id ?? null) !== prevDriverIdRef.current;

    if (justOpened || driverChanged) {
      prevIsOpenRef.current = true;
      prevDriverIdRef.current = driver?.id ?? '__new__';
      setTemporaryPassword(null);
      setCopied(false);
      if (driver) {
        const assignedTruckId = driver.assigned_trucks && driver.assigned_trucks.length > 0
          ? String(driver.assigned_trucks[0].id)
          : '';
        setFormData({
          name: driver.name || '',
          phone: driver.phone || '',
          email: driver.email || '',
          password: '',
          truckMode: assignedTruckId ? 'existing' : 'none',
          truck_id: assignedTruckId,
          newTruckPlate: '',
          newTruckModel: '',
          newTruckCapacity: '500',
          autoEnrollFace: false,
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          password: '',
          truckMode: trucks.length > 0 ? 'existing' : 'new',
          truck_id: trucks.length > 0 ? String(trucks[0].id) : '',
          newTruckPlate: '',
          newTruckModel: '',
          newTruckCapacity: '500',
          autoEnrollFace: false,
        });
      }
    } else if (!driver && trucks.length > 0) {
      setFormData(prev => {
        if (prev.truckMode === 'existing' && !prev.truck_id) {
          return { ...prev, truck_id: String(trucks[0].id) };
        }
        return prev;
      });
    }
  }, [isOpen, driver, trucks]);

  if (!isOpen) return null;

  const handleClose = () => {
    setTemporaryPassword(null);
    setCopied(false);
    onClose();
  };

  const inputStyle = {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '11px 14px',
    borderRadius: '10px',
    width: '100%',
    fontSize: '13px',
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
    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() ? formData.email.trim().toLowerCase() : undefined,
      auto_enroll_face: formData.autoEnrollFace,
    };

    if (formData.password && formData.password.trim()) {
      payload.password = formData.password.trim();
    }

    if (formData.truckMode === 'new') {
      if (formData.newTruckPlate.trim() && formData.newTruckModel.trim()) {
        payload.new_truck = {
          plate: formData.newTruckPlate.trim().toUpperCase(),
          model: formData.newTruckModel.trim(),
          capacity_liters: parseFloat(formData.newTruckCapacity) || 500,
        };
      }
    } else if (formData.truckMode === 'existing' && formData.truck_id) {
      payload.truck_id = parseInt(formData.truck_id, 10);
    } else if (formData.truckMode === 'none') {
      payload.truck_id = null;
    }

    const res = await onSave(payload);
    if (res && res.temporary_password) {
      setTemporaryPassword(res.temporary_password);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => e.target === e.currentTarget && handleClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="driver-modal-title" style={{
        background: 'rgba(11,20,36,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
        width: '100%', maxWidth: '520px', padding: '28px',
        maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        position: 'relative',
      }}>
        {/* Close Button */}
        <button aria-label="Fechar" onClick={handleClose} style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px',
          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-muted, #8BA3BC)',
        }}>
          <X size={16} />
        </button>

        <h2 id="driver-modal-title" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '6px', paddingRight: '40px' }}>
          {temporaryPassword ? 'Motorista Cadastrado' : (driver ? `Editar: ${driver.name}` : 'Cadastrar Novo Motorista')}
        </h2>
        <p style={{ color: 'var(--text-muted, #8BA3BC)', fontSize: '13px', marginBottom: '22px' }}>
          {temporaryPassword
            ? 'Copie a credencial provisória para repassar ao motorista.'
            : (driver ? 'Atualize as credenciais, caminhão e biometria facial' : 'Crie a conta de acesso ao App Mobile e vincule um caminhão')}
        </p>

        {temporaryPassword ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              data-testid="temporary-password-notice"
              style={{
                background: 'rgba(47,190,181,0.12)',
                border: '2px solid #2FBEB5',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2FBEB5', fontWeight: 700, fontSize: '15px' }}>
                <Key size={18} />
                <span>Atenção: Senha Temporária Gerada</span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#e2e8f0', lineHeight: 1.6 }}>
                {`Senha temporária do app: ${temporaryPassword}. Copie agora; ela não será exibida de novo.`}
              </p>
              <div style={{
                background: 'rgba(0,0,0,0.4)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '15px',
                color: '#2FBEB5',
                wordBreak: 'break-all',
                border: '1px solid rgba(47,190,181,0.3)',
              }}>
                {temporaryPassword}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(temporaryPassword);
                    }
                    setCopied(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: copied ? '#34d399' : '#2FBEB5',
                    color: '#0b1424',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
                  color: '#fff',
                  fontFamily: 'var(--font-display, Inter)',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Nome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label htmlFor="driver-name" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={13} color="#2FBEB5" /> Nome Completo *
            </label>
            <input
              id="driver-name"
              type="text"
              required
              placeholder="Ex: João Silva"
              value={formData.name}
              onChange={e => {
                const val = e.target.value;
                setFormData(prev => ({ ...prev, name: val }));
              }}
              style={inputStyle}
              onFocus={focus}
              onBlur={blur}
            />
          </div>

          {/* Grid: Telefone e Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label htmlFor="driver-phone" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={13} color="#2FBEB5" /> Telefone
              </label>
              <input
                id="driver-phone"
                type="text"
                placeholder="(11) 99999-9999"
                value={formData.phone}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => ({ ...prev, phone: val }));
                }}
                style={inputStyle}
                onFocus={focus}
                onBlur={blur}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label htmlFor="driver-email" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={13} color="#2FBEB5" /> E-mail (Login) *
              </label>
              <input
                id="driver-email"
                type="email"
                required
                placeholder="motorista@empresa.com"
                value={formData.email}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => ({ ...prev, email: val }));
                }}
                style={inputStyle}
                onFocus={focus}
                onBlur={blur}
              />
            </div>
          </div>

          {/* Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label htmlFor="driver-password" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={13} color="#2FBEB5" /> {driver ? 'Alterar Senha do App (opcional)' : 'Senha de Acesso (App Mobile)'}
            </label>
            <input
              id="driver-password"
              type="text"
              placeholder={driver ? 'Deixar em branco para manter a atual' : 'Mínimo de 8 caracteres (ou gerada automaticamente)'}
              value={formData.password}
              onChange={e => {
                const val = e.target.value;
                setFormData(prev => ({ ...prev, password: val }));
              }}
              style={inputStyle}
              onFocus={focus}
              onBlur={blur}
            />
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {driver
                ? 'Preencha apenas se desejar redefinir a senha do motorista no app (mín. 8 caracteres).'
                : 'Deixe em branco para gerar uma senha temporária automática, ou informe uma senha com no mínimo 8 caracteres.'}
            </span>
          </div>

          {/* Vínculo de Caminhão */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #8BA3BC)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={13} color="#2FBEB5" /> Vínculo de Caminhão
              </span>
            </div>

            {/* Toggle Mode */}
            <div style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px',
              padding: '3px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, truckMode: 'existing' }))}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: '8px', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: formData.truckMode === 'existing' ? 'rgba(47,190,181,0.2)' : 'transparent',
                  color: formData.truckMode === 'existing' ? '#2FBEB5' : '#8BA3BC',
                }}
              >
                Caminhão Existente
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, truckMode: 'new' }))}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: '8px', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: formData.truckMode === 'new' ? 'rgba(47,190,181,0.2)' : 'transparent',
                  color: formData.truckMode === 'new' ? '#2FBEB5' : '#8BA3BC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                }}
              >
                <PlusCircle size={13} /> + Cadastrar Novo
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, truckMode: 'none', truck_id: '' }))}
                style={{
                  flex: 0.7, padding: '7px 10px', borderRadius: '8px', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: formData.truckMode === 'none' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: formData.truckMode === 'none' ? '#fff' : '#8BA3BC',
                }}
              >
                Nenhum
              </button>
            </div>

            {formData.truckMode === 'existing' && (
              <div>
                <select
                  id="driver-truck"
                  value={formData.truck_id}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, truck_id: val }));
                  }}
                  style={{
                    ...inputStyle,
                    background: '#111D27',
                    cursor: 'pointer',
                  }}
                  onFocus={focus}
                  onBlur={blur}
                >
                  <option value="">Selecione um caminhão da frota...</option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.plate} — {t.model} ({t.capacity_liters}L)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.truckMode === 'new' && (
              <div style={{
                background: 'rgba(47,190,181,0.04)',
                border: '1px solid rgba(47,190,181,0.2)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#2FBEB5' }}>
                  Dados do Novo Caminhão a ser criado e vinculado:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Placa (ex: BRA2E19)"
                    value={formData.newTruckPlate}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setFormData(prev => ({ ...prev, newTruckPlate: val }));
                    }}
                    style={inputStyle}
                    onFocus={focus}
                    onBlur={blur}
                  />
                  <input
                    type="text"
                    placeholder="Modelo (ex: Volvo FH 540)"
                    value={formData.newTruckModel}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, newTruckModel: val }));
                    }}
                    style={inputStyle}
                    onFocus={focus}
                    onBlur={blur}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Capacidade em litros (ex: 500)"
                    value={formData.newTruckCapacity}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, newTruckCapacity: val }));
                    }}
                    style={inputStyle}
                    onFocus={focus}
                    onBlur={blur}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Biometria Facial Auto-Enroll */}
          <div style={{
            background: 'rgba(47,190,181,0.06)',
            border: '1px solid rgba(47,190,181,0.2)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            cursor: 'pointer'
          }} onClick={() => setFormData(prev => ({ ...prev, autoEnrollFace: !prev.autoEnrollFace }))}>
            <div style={{ marginTop: '2px', color: '#2FBEB5' }}>
              {formData.autoEnrollFace ? <CheckSquare size={18} /> : <Square size={18} color="#64748b" />}
            </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="#2FBEB5" /> Somente desenvolvimento: libera o rosto sem cadastro real
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', lineHeight: 1.4 }}>
                  Disponível apenas em ambiente de desenvolvimento com mock facial ativo. Libera o rosto sem validação real de identidade.
                </div>
              </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={handleClose} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary, #94a3b8)',
              fontFamily: 'var(--font-display, Inter)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
              color: '#fff', fontFamily: 'var(--font-display, Inter)', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,190,181,0.3)',
            }}>
              {driver ? 'Salvar Alterações' : 'Cadastrar Motorista'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
