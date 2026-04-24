import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { installGlobalErrorHandlers } from "./lib/debugLog.js";
import "./index.css";

// Hook window.error / unhandledrejection into the debug ring buffer before
// React boots, so any crash during initial render is still captured.
installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
