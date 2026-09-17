const fs = require("fs");
let content = fs.readFileSync("src/App.jsx", "utf8");
if (content.includes("const ProtectedLayout = ({ children }) => {")) {
  content = content.replace("import TopBar from './components/TopBar';", "import TopBar from './components/TopBar';\nimport useFleetState from './store/useFleetState';");
  
  const layoutOld = `const ProtectedLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (`;
  
  const layoutNew = `const ProtectedLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const connectSocket = useFleetState(s => s.connectSocket);
  const disconnectSocket = useFleetState(s => s.disconnectSocket);

  React.useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
    }
    return () => disconnectSocket();
  }, [isAuthenticated, connectSocket, disconnectSocket]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (`;

  content = content.replace(layoutOld, layoutNew);
  fs.writeFileSync("src/App.jsx", content);
  console.log("Bug 4 App.jsx patched");
}
