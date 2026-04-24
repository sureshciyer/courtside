import { Component } from "react";
import { debugLog } from "../lib/debugLog.js";

// Last line of defence. Anything that throws during render / lifecycle /
// commit inside React will land here instead of leaving the user with a
// blank screen. We log the error into the debug buffer and render a dark
// "something crashed" card with a copyable report so the user can hand us
// the full stack in one clipboard paste.

export default class ErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    debugLog.error("ReactErrorBoundary", error, {
      componentStack: info?.componentStack,
    });
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  copyReport = async () => {
    const { error, info } = this.state;
    const report = {
      when: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack || "",
      componentStack: info?.componentStack || "",
      recentEvents: debugLog.get().slice(-40),
      userAgent: (typeof navigator !== "undefined" && navigator.userAgent) || "",
      href: (typeof window !== "undefined" && window.location?.href) || "",
    };
    const text = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      // Lightweight confirm; avoid importing toast libs.
      // eslint-disable-next-line no-alert
      alert("Error report copied to clipboard. Paste it into chat to share.");
    } catch {
      // Clipboard can fail (http, permissions); fall back to prompt so the
      // user can still copy the text manually.
      // eslint-disable-next-line no-alert
      window.prompt("Copy the error JSON:", text);
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { error, info } = this.state;
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 font-display flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div className="max-w-2xl w-full bg-red-950/40 border-2 border-red-800 rounded-xl p-5 sm:p-6">
          <div className="text-4xl mb-2">💥</div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-red-300 mb-2">
            Something crashed
          </h1>
          <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
            The app hit an unexpected error. Your match data is safe — everything is
            in <code className="font-mono text-emerald-300 px-1">localStorage</code>.
            Copy the detailed report below and share it, then reload.
          </p>

          <div className="bg-neutral-950 border border-neutral-800 rounded p-3 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">
              Error
            </div>
            <code className="font-mono text-xs text-red-300 break-words">
              {error?.message || String(error)}
            </code>
          </div>

          {error?.stack && (
            <details className="mb-4">
              <summary className="text-xs text-neutral-400 cursor-pointer hover:text-neutral-200 select-none">
                Show JavaScript stack trace
              </summary>
              <pre className="mt-2 p-3 bg-neutral-950 border border-neutral-800 rounded text-[10px] font-mono text-neutral-300 overflow-auto max-h-40 whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}

          {info?.componentStack && (
            <details className="mb-4">
              <summary className="text-xs text-neutral-400 cursor-pointer hover:text-neutral-200 select-none">
                Show React component stack
              </summary>
              <pre className="mt-2 p-3 bg-neutral-950 border border-neutral-800 rounded text-[10px] font-mono text-neutral-300 overflow-auto max-h-40 whitespace-pre-wrap">
                {info.componentStack}
              </pre>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={this.copyReport}
              className="flex-1 min-w-[140px] py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm active:scale-95"
            >
              📋 Copy error report
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 min-w-[100px] py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 font-bold text-sm active:scale-95"
            >
              ↻ Reload
            </button>
            <button
              onClick={this.reset}
              className="py-2.5 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }
}
