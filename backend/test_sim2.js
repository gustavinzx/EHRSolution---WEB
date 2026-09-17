const { simulateFleet } = require("./src/services/simulator");
simulateFleet(null).then(() => { console.log("Done"); process.exit(); });
