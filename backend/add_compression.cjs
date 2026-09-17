const fs = require("fs");
let content = fs.readFileSync("src/index.js", "utf8");
content = content.replace("const cors = require('cors');", "const cors = require('cors');\nconst compression = require('compression');");
content = content.replace("app.use(express.json());", "app.use(express.json());\napp.use(compression());");
fs.writeFileSync("src/index.js", content);
console.log("Compression added!");
