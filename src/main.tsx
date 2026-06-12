import React from "react";
import ReactDOM from "react-dom/client";

// Local font files (offline-capable; docs/06 Phase 0 task 5). Only the
// weights the UI actually uses ship: 400 (default) and 500 (font-medium) —
// a usage grep guards this diet, re-add a weight before using a new class.
import "@fontsource/noto-sans-tc/400.css";
import "@fontsource/noto-sans-tc/500.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import "./index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA service worker (docs/06 Phase 6) — production only, so dev hot reload
// never fights the cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[pwa] service worker registration failed:", err);
    });
  });
}
