import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Toaster } from "sonner";
import "./App.css";
import { ThemeProvider } from "./lib/theme";
import { dynamicActivate, getStoredLocale } from "./i18n";

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    dynamicActivate(getStoredLocale()).then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider>
        <Outlet />
        <Toaster position="bottom-right" richColors closeButton />
      </ThemeProvider>
    </I18nProvider>
  );
}
