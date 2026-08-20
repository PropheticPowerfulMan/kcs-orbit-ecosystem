import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import './i18n';
import { registerPwa } from './registerPwa';
import MutationFeedback from './components/common/MutationFeedback';

registerPwa();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <MutationFeedback />
    </HashRouter>
  </React.StrictMode>
);
