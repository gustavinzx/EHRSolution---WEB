const axios = require("axios");

async function fix() {
  try {
    const res = await axios.post("http://localhost:3001/api/fleet/4/route", {
      origin: "Belo Horizonte, MG, Brasil",
      destination: "Vitória, ES, Brasil"
    });
    console.log("Fix OK:", res.data.origin, "->", res.data.destination);
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}
fix();
