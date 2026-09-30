import { ReactNode } from "react";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { useAuth } from "./contexts/AuthContext";
import { Dashboard } from "./pages/Dashboard";
import { Editor } from "./pages/Editor";
import { Login } from "./pages/Login";
import { Plans } from "./pages/Plans";
import { Curriculum } from "./pages/Curriculum";
import { Messages } from "./pages/Messages";

const RouteFallback = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-sm font-black text-foreground">Loading secure session...</div>;
  return <Navigate to={currentUser?.status === "active" ? "/" : "/login"} replace />;
};

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-sm font-black text-foreground">Loading secure session...</div>;
  return currentUser?.status === "active" ? children : <Navigate to="/login" replace />;
};

const router = createHashRouter([
  { path: "/login", element: <Login />, errorElement: <RouteFallback /> },
  {
    path: "/",
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    errorElement: <RouteFallback />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "plans", element: <Plans /> },
      { path: "messages", element: <Messages /> },
      { path: "curriculum", element: <Curriculum /> },
      { path: "editor/:id", element: <Editor /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  },
  { path: "*", element: <RouteFallback /> }
]);

export const App = () => <RouterProvider router={router} />;
