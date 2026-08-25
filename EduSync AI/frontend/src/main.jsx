import InstallAppButton from "./components/InstallAppButton";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/theme.css";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { registerPwa } from "./registerPwa";

registerPwa();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
        <InstallAppButton />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
