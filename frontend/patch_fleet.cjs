const fs = require("fs");
let content = fs.readFileSync("src/pages/FleetPage.jsx", "utf8");

const oldLayout = `{/* Map */}
      <div style={{ ...glass, height: '350px' }}>
        <div style={{
          padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>Visão Global da Frota</span>
        </div>
        <div style={{ height: 'calc(100% - 49px)' }}>
          <MapView trucks={trucks} />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>`;

const newLayout = `{/* Split Screen Layout */}
      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: '650px', alignItems: 'stretch' }}>
        
        {/* Left Column: Truck List */}
        <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'16px' }}>`;

content = content.replace(oldLayout, newLayout);

const oldGridEnd = `              </Link>
            );
          })}
        </div>`;

const newGridEnd = `              </Link>
            );
          })}
          </div>
        </div>

        {/* Right Column: Tall Map */}
        <div style={{ flex: '1 1 55%', ...glass, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'var(--bg-panel)'
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>Visão Global da Frota</span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MapView trucks={trucks} />
          </div>
        </div>
      </div>`;

content = content.replace(oldGridEnd, newGridEnd);

fs.writeFileSync("src/pages/FleetPage.jsx", content);
console.log("FleetPage layout patched!");
