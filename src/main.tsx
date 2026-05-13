import{StrictMode}from'react';import{createRoot}from'react-dom/client';import'./index.css';import'./ui-final-polish.css';import'./settings-client-safety-fixes.css';import'./qlo-thinking-toast.css';import'./chat-copy-blocks.css';import'./chat-message-menu.css';import'./chat-user-longpress-menu.css';import'./chat-header-cleanup.css';import'./chat-source-layout-fix.css';import'./api-json-guard';import'./chat-history-retention';import'./chat-composer-enhance';import'./settings-avatar-enhance';import'./settings-accent-picker';import'./qlo-thinking-toast';import'./chat-plain-text-blocks';import'./chat-message-menu';import'./chat-user-longpress-menu';import'./chat-header-cleanup';import App from'./App';createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/qalvero-sw.js').catch(() => undefined);
  });
}
