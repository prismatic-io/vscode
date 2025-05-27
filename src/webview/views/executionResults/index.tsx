import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@webview/lib/AuthProvider";
import { IntegrationProvider } from "@webview/lib/IntegrationProvider";
import { ThemeProvider } from "@webview/lib/theme/ThemeProvider";
import { App } from "./App";
import { ExecutionResultsProvider } from "./ExecutionResultsProvider";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <IntegrationProvider>
          <ExecutionResultsProvider>
            <App />
          </ExecutionResultsProvider>
        </IntegrationProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);
