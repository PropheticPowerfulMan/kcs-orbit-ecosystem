import { ReactNode, useEffect, useState } from "react";
import { createHashRouter, Navigate, RouterProvider, useNavigate, useSearchParams } from "react-router-dom";
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

const InstitutionalSso = () => {
  const { currentUser, loading, signInWithTicket } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    if (loading) return;
    if (currentUser) {
      navigate("/", { replace: true });
      return;
    }
    const ticket = params.get("ticket") || "";
    if (!ticket) {
      setError("The secure launch ticket is missing.");
      return;
    }
    void signInWithTicket(ticket)
      .then(() => navigate("/", { replace: true }))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Secure launch failed."));
  }, [currentUser, loading, navigate, params, signInWithTicket]);
  if (error) {
    return <main className="grid min-h-screen place-items-center bg-[#030d14] p-6 text-center text-white"><div><h1 className="text-xl font-black">Secure access unavailable</h1><p className="mt-2 text-sm text-cyan-100">{error}</p><button className="mt-5 rounded-md bg-cyan-500 px-4 py-2 font-bold text-slate-950" onClick={() => navigate("/login", { replace: true })}>Open sign in</button></div></main>;
  }
  return <div className="grid min-h-screen place-items-center bg-[#030d14] text-sm font-black text-cyan-100">Opening your KCS EduPlanner workspace…</div>;
};

const router = createHashRouter([
  { path: "/login", element: <Login />, errorElement: <RouteFallback /> },
  { path: "/sso", element: <InstitutionalSso />, errorElement: <RouteFallback /> },
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
