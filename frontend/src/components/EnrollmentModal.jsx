import React, { useState } from 'react';
import { Camera, Check, X, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const MOCK_FACE_IMAGE = "data:image/jpeg;base64," + btoa(String.fromCharCode(0xff, 0xd8, 0xff) + "MOCK_FACE_DATA_FOR_ENROLL");

export default function EnrollmentModal({ isOpen, onClose, driver, onEnroll }) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !driver) return null;

  const handleEnroll = async () => {
    if (!consent) {
      toast.error('É necessário confirmar o consentimento do motorista.');
      return;
    }
    setLoading(true);
    try {
      // In a real app, this would capture from webcam.
      // Here we just send the mock base64.
      await onEnroll(driver.id, {
        image_base64: MOCK_FACE_IMAGE.split(',')[1],
        consent: true,
        consent_version: 'v1.0'
      });
      onClose();
    } catch (e) {
      // error handled by hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#111b28', borderRadius: '20px', width: '100%', maxWidth: '480px',
        border: '1px solid #1f2e3b', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', fontFamily: 'var(--font-title)' }}>Cadastrar Biometria Facial</h2>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Motorista: <strong style={{ color: '#fff' }}>{driver.name}</strong></div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '16px', height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px'
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(47,190,181,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={28} color="#2FBEB5" />
            </div>
            <div style={{ fontSize: '14px', color: '#94a3b8' }}>
              (Simulador de captura de imagem)
            </div>
          </div>

          <div style={{ background: 'rgba(59,130,246,0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <Info size={16} color="#3b82f6" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5 }}>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Aviso de Privacidade (LGPD)</strong>
                A biometria facial será utilizada exclusivamente para liberação de abastecimento. A imagem original não será salva; apenas o vetor matemático (template) ficará armazenado de forma segura no provedor de biometria.
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '8px 0' }}>
            <input 
              type="checkbox" 
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              style={{ marginTop: '4px', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2FBEB5' }} 
            />
            <span style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.4 }}>
              Confirmo que li o aviso para o motorista e ele consentiu com o uso e armazenamento de sua biometria facial para fins de autenticação de frota.
            </span>
          </label>
        </div>

        <div style={{ padding: '20px 24px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} disabled={loading} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>Cancelar</button>
          <button onClick={handleEnroll} disabled={loading || !consent} style={{ background: consent ? '#2FBEB5' : '#475569', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', cursor: consent ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loading ? 'Processando...' : <><Check size={16}/> Confirmar Cadastro</>}
          </button>
        </div>
      </div>
    </div>
  );
}
