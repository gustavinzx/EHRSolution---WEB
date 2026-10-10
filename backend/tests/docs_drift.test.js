const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app } = require('../src/index');

describe('Docs Drift Tests (API_MOBILE.md)', () => {
  let docContent = '';
  let backendFiles = [];
  let apiContractContent = '';
  let envExampleContent = '';

  beforeAll(() => {
    const docPath = path.join(__dirname, '../../docs/API_MOBILE.md');
    docContent = fs.readFileSync(docPath, 'utf8');

    function readDir(dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
          results = results.concat(readDir(file));
        } else if (file.endsWith('.js')) {
          results.push(fs.readFileSync(file, 'utf8'));
        }
      });
      return results;
    }
    backendFiles = readDir(path.join(__dirname, '../src'));
    
    apiContractContent = fs.readFileSync(path.join(__dirname, 'api_contract.test.js'), 'utf8');
    
    try {
      envExampleContent = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
    } catch(e) {}
  });

  it('Verifica se toda rota citada no doc existe no backend (supertest 404)', async () => {
    const routesMatches = [...docContent.matchAll(/### `(POST|GET|PUT|PATCH|DELETE) (\/api\/[^`]+)`/g)];
    
    // Devem existir pelo menos 9 rotas no documento
    expect(routesMatches.length).toBeGreaterThanOrEqual(9);
    
    for (const match of routesMatches) {
      const method = match[1].toLowerCase();
      let routePath = match[2];
      
      // trocar :id/:truckId por 1
      routePath = routePath.replace(/:id/g, '1').replace(/:truckId/g, '1');
      
      const res = await request(app)[method](routePath);
      
      // O Express padrão devolve HTML com "Cannot METHOD /path" em 404 de rotas não montadas
      // Se a rota existir (mesmo que falhe por auth), ela vai cair num middleware que devolve JSON ou outro status.
      // A regra é: não pode ser o 404 nativo do express
      const isExpressNotFound = res.status === 404 && res.text && res.text.includes(`Cannot ${method.toUpperCase()} `);
      
      if (isExpressNotFound) {
        console.error(`Rota não montada no express: ${method.toUpperCase()} ${routePath}`);
      }
      expect(isExpressNotFound).toBe(false);
    }
  });

  it('Verifica se todos os literais de erro citados no doc existem no código fonte e no api_contract.test.js', () => {
    const errorMatches = [...docContent.matchAll(/"error":\s*"([^"]+)"/g)];
    
    // expect >= 40
    expect(errorMatches.length).toBeGreaterThanOrEqual(40);
    
    for (const match of errorMatches) {
      const errorMsg = match[1];
      let foundInSrc = false;
      for (const fileContent of backendFiles) {
        if (fileContent.includes(errorMsg)) {
          foundInSrc = true;
          break;
        }
      }
      
      if (!foundInSrc) {
        console.error(`Erro do doc não encontrado no src: "${errorMsg}"`);
      }
      expect(foundInSrc).toBe(true);
      
      const foundInTest = apiContractContent.includes(errorMsg);
      if (!foundInTest) {
        console.error(`Erro do doc não testado em api_contract.test.js: "${errorMsg}"`);
      }
      expect(foundInTest).toBe(true);
    }
  });

  it('Verifica se as variáveis de ambiente em MAIÚSCULAS entre crases existem no código', () => {
    // Pega variáveis entre crases, que sejam só letras maiúsculas e underscore
    const envMatches = [...docContent.matchAll(/`([A-Z_]+)`/g)];
    
    for (const match of envMatches) {
      const envName = match[1];
      
      let foundInSrc = false;
      for (const fileContent of backendFiles) {
        if (fileContent.includes(envName)) {
          foundInSrc = true;
          break;
        }
      }
      
      const foundInEnv = envExampleContent.includes(envName);
      
      const found = foundInSrc || foundInEnv;
      if (!found) {
        console.error(`Variável do doc não encontrada no src nem no .env.example: "${envName}"`);
      }
      expect(found).toBe(true);
    }
  });
});
