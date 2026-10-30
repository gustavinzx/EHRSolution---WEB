import React, { useState, useRef } from 'react';
import { Camera, Check, X, Info, Upload, Sparkles, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

// Minimal valid JPEG binary buffer encoded to base64
const DEFAULT_MOCK_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

export default function EnrollmentModal({ isOpen, onClose, driver, onEnroll }) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(driver?.face_photo || DEFAULT_MOCK_IMAGE);
  const fileInputRef = useRef(null);

  if (!isOpen || !driver) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem excede o tamanho máximo de 2MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      toast.error('Formato inválido. Apenas imagens JPEG e PNG são permitidas.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
      toast.success('Foto carregada com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  const handleUseSimulator = () => {
    setPreviewUrl(DEFAULT_MOCK_IMAGE);
    toast.success('Captura simulada selecionada!');
  };

  const handleEnroll = async () => {
    if (!consent) {
      toast.error('É necessário confirmar o consentimento do motorista.');
      return;
    }
    setLoading(true);
    try {
      const base64Data = previewUrl.includes(',') ? previewUrl.split(',')[1] : previewUrl;
      await onEnroll(driver.id, {
        image_base64: base64Data,
        consent: true,
        consent_version: 'v1.0'
      });
      toast.success('Biometria e foto cadastradas com sucesso!');
      onClose();
    } catch (e) {
      // erro tratado no hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      padding: '20px'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#111b28', borderRadius: '20px', width: '100%', maxWidth: '480px',
        border: '1px solid #1f2e3b', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', fontFamily: 'var(--font-title, Inter)' }}>
              Cadastrar Biometria Facial
            </h2>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              Motorista: <strong style={{ color: '#2FBEB5' }}>{driver.name}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Photo Preview Box */}
          <div style={{ 
            background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(47,190,181,0.4)',
            borderRadius: '16px', minHeight: '190px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative',
            overflow: 'hidden'
          }}>
            {previewUrl && previewUrl !== DEFAULT_MOCK_IMAGE ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <img
                  src={previewUrl}
                  alt="Pré-visualização do motorista"
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #2FBEB5', boxShadow: '0 0 20px rgba(47,190,181,0.3)' }}
                />
                <span style={{ fontSize: '12px', color: '#2FBEB5', fontWeight: 600 }}>Foto pronta para cadastro</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(47,190,181,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={26} color="#2FBEB5" />
                </div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>
                  Selecione uma foto ou use a simulação
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                  Arquivos JPG ou PNG até 2MB
                </div>
              </div>
            )}
          </div>

          {/* Action buttons for photo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/jpg"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                background: 'rgba(47,190,181,0.12)', border: '1px solid rgba(47,190,181,0.3)',
                color: '#2FBEB5', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Upload size={15} /> Carregar Foto
            </button>
            <button
              type="button"
              onClick={handleUseSimulator}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e8f0', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Sparkles size={15} color="#fbbf24" /> Simular Captura
            </button>
          </div>

          {/* LGPD Disclaimer */}
          <div style={{ background: 'rgba(59,130,246,0.08)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <Info size={16} color="#3b82f6" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '2px' }}>Aviso de Privacidade (LGPD)</strong>
                A biometria facial e a fotografia do motorista são utilizadas para segurança da operação, controle de abastecimento e identificação no painel de gestão.
              </div>
            </div>
          </div>

          {/* Consent Checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2FBEB5' }} 
            />
            <span style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
              Confirmo que o motorista consentiu com o registro e autenticação facial para fins de autorização de frota.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding: '18px 24px', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} disabled={loading} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            Cancelar
          </button>
          <button onClick={handleEnroll} disabled={loading || !consent} style={{
            background: consent ? 'linear-gradient(135deg, #2FBEB5, #4F8EF7)' : '#475569',
            color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '10px',
            cursor: consent ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: consent ? '0 4px 16px rgba(47,190,181,0.3)' : 'none'
          }}>
            {loading ? <><RefreshCw size={14} className="spin" /> Processando...</> : <><Check size={16}/> Confirmar Cadastro</>}
          </button>
        </div>
      </div>
    </div>
  );
}
