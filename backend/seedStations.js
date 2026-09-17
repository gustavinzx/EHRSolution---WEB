require("dotenv").config();
const { pool } = require("./src/config/db");

// 30 postos reais ao longo das 10 rotas do seed
// Coordenadas verificadas no OpenStreetMap / IBGE
const stations = [
  // SP -> RJ (BR-116 / Via Dutra)
  { name: "Posto Shell Guarulhos", brand: "Shell", address: "Av. Guarulhos, SP", lat: -23.4543, lng: -46.5332 },
  { name: "Posto BR Taubaté", brand: "Petrobras", address: "Rodovia Presidente Dutra, Taubaté - SP", lat: -23.0278, lng: -45.5562 },
  { name: "Posto Ipiranga Volta Redonda", brand: "Ipiranga", address: "Av. Paulo de Frontin, VR - RJ", lat: -22.5155, lng: -44.1052 },

  // Brasília -> Goiânia (BR-060)
  { name: "Posto Petrobras Luziânia", brand: "Petrobras", address: "BR-060, Luziânia - GO", lat: -16.2526, lng: -47.9606 },
  { name: "Posto Shell Anápolis", brand: "Shell", address: "Av. Brasil, Anápolis - GO", lat: -16.3283, lng: -48.9527 },

  // Curitiba -> Florianópolis (BR-376 / BR-101)
  { name: "Posto Ipiranga Joinville", brand: "Ipiranga", address: "BR-101, Joinville - SC", lat: -26.2950, lng: -48.8490 },
  { name: "Posto BR Garuva", brand: "Petrobras", address: "BR-101, Garuva - SC", lat: -26.0256, lng: -48.8490 },
  { name: "Posto Shell São José", brand: "Shell", address: "BR-101, São José - SC", lat: -27.5955, lng: -48.6345 },

  // BH -> Vitória (BR-262)
  { name: "Posto Petrobras Ipatinga", brand: "Petrobras", address: "BR-458, Ipatinga - MG", lat: -19.4683, lng: -42.5377 },
  { name: "Posto Ipiranga Manhuaçu", brand: "Ipiranga", address: "BR-262, Manhuaçu - MG", lat: -20.2586, lng: -42.0291 },
  { name: "Posto BR Venda Nova do Imigrante", brand: "Petrobras", address: "BR-262, Venda Nova - ES", lat: -20.3344, lng: -41.1350 },

  // Salvador -> Aracaju (BR-101 / BR-116)
  { name: "Posto Shell Simões Filho", brand: "Shell", address: "BR-324, Simões Filho - BA", lat: -12.7887, lng: -38.3994 },
  { name: "Posto Ipiranga Itabuna", brand: "Ipiranga", address: "BR-415, Itabuna - BA", lat: -14.7882, lng: -39.2814 },
  { name: "Posto BR Estância", brand: "Petrobras", address: "BR-101, Estância - SE", lat: -11.2672, lng: -37.4388 },

  // Recife -> João Pessoa (BR-101)
  { name: "Posto Shell Olinda", brand: "Shell", address: "BR-101, Olinda - PE", lat: -8.0076, lng: -34.8530 },
  { name: "Posto Petrobras Goiana", brand: "Petrobras", address: "BR-101, Goiana - PE", lat: -7.5590, lng: -35.0032 },
  { name: "Posto Ipiranga Pedras de Fogo", brand: "Ipiranga", address: "BR-101, Pedras de Fogo - PB", lat: -7.4004, lng: -35.1222 },

  // Fortaleza -> Natal (BR-304 / BR-101)
  { name: "Posto BR Pacajus", brand: "Petrobras", address: "BR-116, Pacajus - CE", lat: -4.1715, lng: -38.4614 },
  { name: "Posto Shell Mossoró", brand: "Shell", address: "BR-304, Mossoró - RN", lat: -5.1877, lng: -37.3440 },
  { name: "Posto Ipiranga Macaíba", brand: "Ipiranga", address: "BR-304, Macaíba - RN", lat: -5.8546, lng: -35.3568 },

  // Porto Alegre -> Caxias do Sul (BR-116)
  { name: "Posto Shell Novo Hamburgo", brand: "Shell", address: "BR-116, Novo Hamburgo - RS", lat: -29.6783, lng: -51.1306 },
  { name: "Posto BR Farroupilha", brand: "Petrobras", address: "BR-116, Farroupilha - RS", lat: -29.2248, lng: -51.3473 },

  // Cuiabá -> Campo Grande (BR-163)
  { name: "Posto Ipiranga Rondonópolis", brand: "Ipiranga", address: "BR-364, Rondonópolis - MT", lat: -16.4710, lng: -54.6386 },
  { name: "Posto Shell Itiquira", brand: "Shell", address: "BR-163, Itiquira - MT", lat: -17.2057, lng: -54.1501 },
  { name: "Posto BR Sonora", brand: "Petrobras", address: "BR-163, Sonora - MS", lat: -17.5658, lng: -54.7572 },
  { name: "Posto Ipiranga Coxim", brand: "Ipiranga", address: "BR-163, Coxim - MS", lat: -18.5069, lng: -54.7578 },

  // Manaus -> Boa Vista (BR-174)
  { name: "Posto BR Presidente Figueiredo", brand: "Petrobras", address: "BR-174, Presidente Figueiredo - AM", lat: -2.0315, lng: -60.0262 },
  { name: "Posto Shell Rorainópolis", brand: "Shell", address: "BR-174, Rorainópolis - RR", lat: 0.9413, lng: -60.4390 },
  { name: "Posto Ipiranga Caracaraí", brand: "Ipiranga", address: "BR-174, Caracaraí - RR", lat: 1.8244, lng: -61.1291 },

  // Extras na BR-116 e BR-101 (postos genéricos em grandes trechos)
  { name: "Posto Combustível Total Caruaru", brand: "Total", address: "BR-232, Caruaru - PE", lat: -8.2836, lng: -36.0051 },
  { name: "Posto Raízen Feira de Santana", brand: "Shell", address: "BR-116, Feira de Santana - BA", lat: -12.2664, lng: -38.9668 }
];

async function seedStations() {
  const client = await pool.connect();
  try {
    console.log(`Inserting ${stations.length} fuel stations...`);
    for (const s of stations) {
      await client.query(
        "INSERT INTO fuel_stations (name, brand, address, lat, lng, active, source) VALUES ($1,$2,$3,$4,$5,true,'seed') ON CONFLICT DO NOTHING",
        [s.name, s.brand, s.address, s.lat, s.lng]
      );
    }
    const { rows } = await client.query("SELECT COUNT(*) FROM fuel_stations");
    console.log(`Done! Total stations in DB: ${rows[0].count}`);
  } catch (err) {
    console.error("Seed stations failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seedStations();
