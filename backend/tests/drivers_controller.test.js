describe('driversController.update unit', () => {
  let drivers;
  let clientMock;
  let dbMock;
  let driversController;

  beforeEach(() => {
    drivers = [{ id: 1, name: 'Alice', phone: '111', email: 'a@a.com', is_active: true, face_enrolled: false }];
    
    clientMock = {
      query: jest.fn(async (sql, params = []) => {
        if (sql.includes('UPDATE drivers SET')) {
          const id = Number(params[params.length - 1]);
          const d = drivers.find((item) => item.id === id);
          if (d) {
            d.name = params[0];
            d.phone = params[1];
            d.email = params[2];
            return { rows: [d] };
          }
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn()
    };

    dbMock = {
      pool: {
        connect: jest.fn(async () => clientMock)
      },
      query: clientMock.query
    };

    jest.isolateModules(() => {
      jest.doMock('../src/config/db', () => dbMock);
      driversController = require('../src/controllers/driversController');
    });
  });

  afterEach(() => {
    jest.dontMock('../src/config/db');
  });

  it('PUT /api/drivers/:id returns 200 and updates driver properly without truck_id error', async () => {
    let status;
    let response;
    const req = {
      params: { id: '1' },
      body: { name: 'Alice Updated', phone: '222', email: 'a2@a.com' }
    };
    const res = {
      status: (s) => { status = s; return res; },
      json: (data) => { response = data; }
    };

    await driversController.update(req, res);

    expect(status).toBeUndefined(); // res.json called directly (defaults to 200)
    expect(response.name).toBe('Alice Updated');
    expect(response.phone).toBe('222');
    expect(clientMock.release).toHaveBeenCalled();
  });
});
