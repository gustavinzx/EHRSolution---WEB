const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock db
let drivers = [{ id: 1, name: 'Alice', phone: '111', email: 'a@a.com' }];
const db = {
  query: async (sql, params) => {
    if (sql.includes('UPDATE drivers SET')) {
      const d = drivers.find(d => d.id === Number(params[3]));
      if (d) {
        d.name = params[0];
        d.phone = params[1];
        d.email = params[2];
        return { rows: [d] };
      }
      return { rows: [] };
    }
    return { rows: [] };
  }
};

require.cache[require.resolve('../src/config/db')] = { exports: db };

const driversController = require('../src/controllers/driversController');

test('PUT /api/drivers/:id returns 200 and updates driver properly without truck_id error', async () => {
  let status, response;
  const req = { params: { id: '1' }, body: { name: 'Alice Updated', phone: '222', email: 'a2@a.com' } };
  const res = {
    status: (s) => { status = s; return res; },
    json: (data) => { response = data; }
  };

  await driversController.update(req, res);
  
  assert.equal(status, undefined); // res.json was called directly (defaults to 200)
  assert.equal(response.name, 'Alice Updated');
  assert.equal(response.phone, '222');
});
