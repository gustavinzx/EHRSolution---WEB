const fs = require("fs");
let content = fs.readFileSync("src/index.js", "utf8");

const oldCode = `io.on('connection', (socket) => {`;
const newCode = `const jwt = require('jsonwebtoken');
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync("src/index.js", content);
  console.log("Bug 2 (backend) fixed");
} else {
  console.log("Bug 2 (backend) failed to patch");
}
