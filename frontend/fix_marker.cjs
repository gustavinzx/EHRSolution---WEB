const fs = require("fs");
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");

content = content.replace(
  /if \(truck\.sim_state === 'fueling'\) \{\s*return \s*<div style="position:relative;display:flex;align-items:center;justify-content:center;">\s*<div style="width: 36px; height: 36px; background: ; border-radius: 50%; border: 3px solid #fff; box-shadow: \s*0 0 15px ; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; animation: pulse \s*1.5s infinite;">\s*🚛\s*<\/div>\s*<div style="position:absolute; bottom:-5px; right:-5px; background:#ef4444; border-radius:50%; width:20px; \s*height:20px; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid #fff;">⛽<\/div>\s*<\/div>\s*;\s*\}/,
  `if (truck.sim_state === 'fueling') {
    return \`
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        \${driverTag}
        <div style="width: 36px; height: 36px; background: \${color}; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 15px \${color}; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; animation: pulse 1.5s infinite;">
          🚛
        </div>
        <div style="position:absolute; bottom:-5px; right:-5px; background:#ef4444; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid #fff;">⛽</div>
      </div>
    \`;
  }`
);

fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);
