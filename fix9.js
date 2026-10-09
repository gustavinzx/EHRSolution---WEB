const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/DriversPage.jsx', 'utf8');

c = c.replace(/import DriverModal from '\.\.\/components\/DriverModal';/, "import DriverModal from '../components/DriverModal';\nimport EnrollmentModal from '../components/EnrollmentModal';\nimport { Camera, Trash2 } from 'lucide-react';");

c = c.replace(/const \{ drivers, loading, error, fetchDrivers, createDriver, updateDriver, deactivateDriver, activateDriver, assignTruck \} = useDrivers\(\);/, "const { drivers, loading, error, fetchDrivers, createDriver, updateDriver, deactivateDriver, activateDriver, assignTruck, enrollFace, removeFace } = useDrivers();\n  const [enrollDriverTarget, setEnrollDriverTarget] = useState(null);");

c = c.replace(/<DriverModal\s+isOpen=\{isModalOpen\}\s+onClose=\{\(\) => \{ setIsModalOpen\(false\); setEditingDriver\(null\); \}\}\s+onSave=\{handleSave\}\s+driver=\{editingDriver\}\s+\/>/, `<DriverModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingDriver(null); }}
        onSave={handleSave}
        driver={editingDriver}
      />
      <EnrollmentModal
        isOpen={!!enrollDriverTarget}
        onClose={() => setEnrollDriverTarget(null)}
        onEnroll={enrollFace}
        driver={enrollDriverTarget}
      />`);

c = c.replace(/\{\/\* Vehicles Tags \*\/\}/, `{/* Biometria */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: d.face_enrolled ? 'rgba(47,190,181,0.1)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={16} color={d.face_enrolled ? '#2FBEB5' : '#64748b'} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: d.face_enrolled ? '#e2e8f0' : '#94a3b8' }}>{d.face_enrolled ? 'Biometria Ativa' : 'Sem Biometria'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Autenticação facial</div>
                    </div>
                  </div>
                  {d.face_enrolled ? (
                    <button onClick={() => window.confirm('Revogar biometria deste motorista?') && removeFace(d.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }} title="Revogar Biometria">
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setEnrollDriverTarget(d)} style={{ background: 'rgba(47,190,181,0.1)', border: '1px solid rgba(47,190,181,0.2)', color: '#2FBEB5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Cadastrar
                    </button>
                  )}
                </div>

                {/* Vehicles Tags */}`);

fs.writeFileSync('frontend/src/pages/DriversPage.jsx', c);
