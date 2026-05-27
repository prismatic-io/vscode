import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/webview/providers/theme/ThemeProvider";
import { App } from "@/webview/views/batchProgress/App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
