import { useAuth } from "./context/AuthContext";
import AuthPanel from "./components/AuthPanel";
import DashboardPanel from "./components/DashboardPanel";

export default function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <DashboardPanel /> : <AuthPanel />;
}
