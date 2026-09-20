import { useAuth } from "./context/AuthContext";
import AuthPanel from "./components/AuthPanel";
import DashboardPanel from "./components/DashboardPanel";

import { SecurePageLoader } from './components/SecurePageState';

export default function App() {
  const { isAuthenticated, profileLoading } = useAuth();
  if (profileLoading) return <SecurePageLoader />;
  return isAuthenticated ? <DashboardPanel /> : <AuthPanel />;
}
