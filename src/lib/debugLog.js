// In-memory ring buffer for debug events. Captures React render errors,
// unhandled JS exceptions, and promise rejections — plus any `info`/`error`
// events screens record manually. Nothing here is persisted to localStorage
// so match data stays untouched; the log is session-scoped.
//
// Consumers:
//   - ErrorBoundary records React render errors here
//   - window.error / unhandledrejection handlers (installed at app boot)
//   - Settings → Debug panel renders + allows copy/clear + toggles verbose
//     console mirroring

const BUFFER_SIZE = 200;

let buffer = [];
let enabled = false;
const listeners = new Set();

const notify = (entry) => {
  for (const fn of listeners) {
    try { fn(entry); } catch { /* listener errors must not crash the logger */ }
  }
};

export const debugLog = {
  record(entry) {
    const e = { ...entry, ts: Date.now() };
    buffer.push(e);
    if (buffer.length > BUFFER_SIZE) buffer.shift();
    if (enabled) {
      const tag = `[courtside] ${e.type}${e.source ? ` · ${e.source}` : ""}`;
      if (e.type === "error") console.error(tag, e);
      else console.log(tag, e);
    }
    notify(e);
    return e;
  },

  error(source, err, extra = {}) {
    return this.record({
      type: "error",
      source,
      message: err?.message || String(err || "unknown error"),
      stack: err?.stack || "",
      ...extra,
    });
  },

  info(source, message, extra = {}) {
    return this.record({ type: "info", source, message, ...extra });
  },

  get() {
    return buffer.slice();
  },

  clear() {
    buffer = [];
    notify({ type: "cleared", ts: Date.now() });
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  setEnabled(v) { enabled = !!v; },
  isEnabled() { return enabled; },
};

// Install once at boot. Wraps window-level error channels so anything that
// escapes React still lands in the buffer.
let installed = false;
export const installGlobalErrorHandlers = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    debugLog.error("window.error", ev.error || ev.message, {
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    debugLog.error("unhandledrejection", ev.reason, {});
  });

  debugLog.info("boot", "app started", {
    href: window.location?.href,
    ua: navigator?.userAgent,
  });
};
