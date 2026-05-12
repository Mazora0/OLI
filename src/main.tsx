import{StrictMode}from'react';import{createRoot}from'react-dom/client';import'./index.css';import'./ui-final-polish.css';import'./chat-composer-enhance';import App from'./App';createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/qalvero-sw.js').catch(() => undefined);
  });
}
