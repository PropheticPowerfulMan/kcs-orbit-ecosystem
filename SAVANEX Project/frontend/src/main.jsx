import InstallAppButton from './components/InstallAppButton';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import './i18n';
import { registerPwa } from './registerPwa';
import MutationFeedback from './components/common/MutationFeedback';
import GlobalLanguageBridge from './localization/GlobalLanguageBridge';

registerPwa();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <GlobalLanguageBridge />
      <App />
      <MutationFeedback />
      <InstallAppButton />
    </HashRouter>
  </React.StrictMode>
);
