import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const PWA_RESET_VERSION = "2026-04-03-room-presence-ui";
const PWA_RESET_STORAGE_KEY = "lovable:pwa-reset-version";

const resetStaleAppShell = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("caches" in window)) {
    return;
  }

  try {
    if (window.localStorage.getItem(PWA_RESET_STORAGE_KEY) === PWA_RESET_VERSION) {
      return;
    }

    const [registrations, cacheKeys] = await Promise.all([
      navigator.serviceWorker.getRegistrations(),
      window.caches.keys(),
    ]);

    if (registrations.length === 0 && cacheKeys.length === 0) {
      window.localStorage.setItem(PWA_RESET_STORAGE_KEY, PWA_RESET_VERSION);
      return;
    }

    await Promise.all([
      ...registrations.map((registration) => registration.unregister()),
      ...cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)),
    ]);

    window.localStorage.setItem(PWA_RESET_STORAGE_KEY, PWA_RESET_VERSION);
    window.location.reload();
  } catch (error) {
    console.error("PWA cache reset failed", error);
  }
};

void resetStaleAppShell();

createRoot(document.getElementById("root")!).render(<App />);
