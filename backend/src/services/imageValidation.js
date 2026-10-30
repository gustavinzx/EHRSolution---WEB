exports.validateImageBase64 = (base64) => {
  if (typeof base64 !== 'string') {
    const err = new Error('A imagem deve ser uma string em base64');
    err.status = 400;
    throw err;
  }
  
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > 2 * 1024 * 1024) {
    const err = new Error('A imagem excede o tamanho máximo de 2MB');
    err.status = 400;
    throw err;
  }
  
  if (buffer.length < 4) {
    const err = new Error('Formato de imagem inválido. Apenas JPEG e PNG são permitidos.');
    err.status = 400;
    throw err;
  }
  
  const hex = buffer.toString('hex', 0, 4);
  if (!hex.startsWith('ffd8') && hex !== '89504e47') {
    const err = new Error('Formato de imagem inválido. Apenas JPEG e PNG são permitidos.');
    err.status = 400;
    throw err;
  }
  
  return { buffer };
};
