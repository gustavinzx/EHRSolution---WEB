const fs = require('fs');
const path = require('path');

describe('Docs Drift Tests (API_MOBILE.md)', () => {
  let docContent = '';
  let backendFiles = [];

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
  });

  it('Verifica se toda rota citada no doc existe no backend', () => {
    const routesMatches = docContent.matchAll(/### `(POST|GET|PUT|PATCH|DELETE) \/api\/([^`]+)`/g);
    for (const match of routesMatches) {
      const method = match[1];
      let routePath = match[2];
      // Convert params like :id to just checking if the base word exists, 
      // or we can just check if any backend file has the route.
      let baseRoute = routePath.split('/:')[0];
      baseRoute = baseRoute.replace('/sessions', ''); // since sessions are inside fueling controller/router
      
      let found = false;
      let checkStr = routePath
        .replace('auth/', '')
        .replace('fueling/sessions', 'sessions')
        .replace('fueling/', '')
        .split('/:')[0];
        
      for (const fileContent of backendFiles) {
        if (fileContent.includes(checkStr)) {
          found = true;
          break;
        }
      }
      if (!found) console.log('Route not found:', checkStr);
      expect(found).toBe(true);
    }
  });

  it('Verifica se todos os literais de erro citados no doc existem no código fonte', () => {
    // Procura por `{ "error": "Alguma string" }`
    const errorMatches = docContent.matchAll(/"error":\s*"([^"]+)"/g);
    for (const match of errorMatches) {
      const errorMsg = match[1];
      let found = false;
      for (const fileContent of backendFiles) {
        if (fileContent.includes(errorMsg)) {
          found = true;
          break;
        }
      }
      // "Driver Authorization token missing or invalid"
      // Se não achar, o doc está defasado!
      expect(found).toBe(true);
    }
  });

  it('Verifica se as variáveis de ambiente citadas existem no código', () => {
    const envs = ['SESSION_TTL_MIN', 'FACE_PROVIDER', 'FACE_MATCH_THRESHOLD', 'FACIAL_MAX_ATTEMPTS', 'FACIAL_ATTEMPTS_RETENTION_DAYS'];
    for (const env of envs) {
      let found = false;
      for (const fileContent of backendFiles) {
        if (fileContent.includes(env)) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });
});
