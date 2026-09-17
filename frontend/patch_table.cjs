const fs = require("fs");
let content = fs.readFileSync("src/components/FuelingTable.jsx", "utf8");

const oldCode = `<td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {log.lat != null ? Number(log.lat).toFixed(4) : '—'},&nbsp;
                  {log.lng != null ? Number(log.lng).toFixed(4) : '—'}
                </td>`;

const newCode = `<td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {log.lat != null ? (
                    <a href={\`https://www.google.com/maps/search/?api=1&query=\${log.lat},\${log.lng}\`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(47,190,181,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(47,190,181,0.2)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {Number(log.lat).toFixed(4)}, {Number(log.lng).toFixed(4)}
                    </a>
                  ) : '—'}
                </td>`;

content = content.replace(oldCode, newCode);

fs.writeFileSync("src/components/FuelingTable.jsx", content);
console.log("FuelingTable coordinates linked!");
