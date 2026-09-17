const http = require('http');
const loginReq = http.request({
  hostname:'127.0.0.1', port:3001, path:'/api/auth/login', method:'POST',
  headers:{'Content-Type':'application/json'}
}, (res) => {
  let d=''; res.on('data',c=>d+=c);
  res.on('end',()=>{
    const token=JSON.parse(d).token;
    const routeReq = http.request({
      hostname:'127.0.0.1', port:3001, path:'/api/fleet/1/route', method:'GET',
      headers:{Authorization:'Bearer '+token}
    },(r2)=>{
      let d2=''; r2.on('data',c=>d2+=c);
      r2.on('end',()=>{
        const parsed = JSON.parse(d2);
        console.log('Status:', r2.statusCode);
        console.log('Keys:', Object.keys(parsed));
        console.log('route_geometry is array:', Array.isArray(parsed.route_geometry));
        console.log('Length:', Array.isArray(parsed.route_geometry) ? parsed.route_geometry.length : 'N/A');
        console.log('Sample point:', Array.isArray(parsed.route_geometry) ? JSON.stringify(parsed.route_geometry[0]) : 'N/A');
        process.exit(0);
      });
    });
    routeReq.end();
  });
});
loginReq.write(JSON.stringify({email:'gestor@ehr.com',password:'Demo@1234'}));
loginReq.end();
