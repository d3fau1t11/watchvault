import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './redesign.css';
import './updates.css';
import './account-layout.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the PWA service worker to handle offline caching
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    const shouldUpdate = window.confirm(
      "A new version of WatchVault is available! Would you like to load it now?"
    );
    if (shouldUpdate) {
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    }
  }
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

