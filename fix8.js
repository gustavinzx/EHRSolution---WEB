const fs = require('fs');
let c = fs.readFileSync('frontend/src/hooks/useDrivers.js', 'utf8');

const newFunctions = `
  const enrollFace = async (id, payload) => {
    try {
      const response = await client.post(\`/drivers/\${id}/face/enroll\`, payload);
      setDrivers(prev => prev.map(d => d.id === id ? { ...d, face_enrolled: response.data.face_enrolled } : d));
      toast.success('Biometria cadastrada com sucesso');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar biometria');
      return false;
    }
  };

  const removeFace = async (id) => {
    try {
      const response = await client.delete(\`/drivers/\${id}/face\`);
      setDrivers(prev => prev.map(d => d.id === id ? { ...d, face_enrolled: response.data.face_enrolled } : d));
      toast.success('Biometria removida com sucesso');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover biometria');
      return false;
    }
  };

  return { drivers, loading, error, fetchDrivers, createDriver, updateDriver, deactivateDriver, activateDriver, assignTruck, enrollFace, removeFace };
`;

c = c.replace(/return \{ drivers, loading, error, fetchDrivers, createDriver, updateDriver, deactivateDriver, activateDriver, assignTruck \};/, newFunctions);

fs.writeFileSync('frontend/src/hooks/useDrivers.js', c);
