import React from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./components/Toast";
import { AppProvider } from "./contexts/AppContext";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
import { App } from "./App";
import { AppTranslator } from "./components/AppTranslator";
import { applyFinalProductionReset } from "./services/finalResetService";
import { initializePwaInstall, registerPwaServiceWorker } from "./services/pwaService";
import { normalizeRecoveryUrlBeforeRouter } from "./services/urlRecoveryService";

normalizeRecoveryUrlBeforeRouter();
initializePwaInstall();
applyFinalProductionReset();
registerPwaServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <AppTranslator />
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>
);
