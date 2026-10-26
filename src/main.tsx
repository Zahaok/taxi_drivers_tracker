import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Глобальный обработчик необработанных промис-ошибок (например, недоступный бэкенд):
// не даём fallbэк-странице «умереть молча», выводим понятное сообщение.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String((event.reason && (event.reason as any).message) || event.reason || 'Неизвестная ошибка');
  if (/Failed to fetch|Сервер SVdrivers|API-эндпоинт/i.test(msg)) {
    event.preventDefault(); // не считаем фатальным — UI покажет ошибку сам
  }
});

// Error Boundary: вместо пустого белого экрана при любой ошибке рендера
// показываем диагностику с текстом ошибки (актуально для minified-сборок на IIS).
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; info: string }
> {
  state = { error: null as Error | null, info: '' };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info: info.componentStack || '' });
    // eslint-disable-next-line no-console
    console.error('[SVdrivers] Render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f6f7f9', fontFamily: 'Manrope, system-ui, sans-serif' }}>
          <div style={{ maxWidth: 640, width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 28, boxShadow: '0 8px 30px rgba(0,0,0,.08)' }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Произошла ошибка приложения</h1>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 12px' }}>SVdrivers · диагностика:</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: 14, fontSize: 13 }}>{String(this.state.error.message || this.state.error)}</pre>
            {this.state.info ? (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>Компоненты</summary>
                <pre style={{ whiteSpace: 'pre-wrap', color: '#6b7280', fontSize: 12, maxHeight: 240, overflow: 'auto' }}>{this.state.info}</pre>
              </details>
            ) : null}
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 16, padding: '10px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  // Частая причина Minified React error #299/#310 на IIS: index.html отдан без контейнера или скрипт стартует раньше DOM.
  document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;text-align:center">Не найден элемент #root в HTML страницы. Проверьте index.html на сервере.</div>';
} else {
  ReactDOM.createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
