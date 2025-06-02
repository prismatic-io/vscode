import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/webview/providers/AuthProvider";
import { IntegrationProvider } from "@/webview/providers/IntegrationProvider";
import { ThemeProvider } from "@/webview/providers/theme/ThemeProvider";
import { ExecutionResultsProvider } from "@/webview/views/executionResults/providers/ExecutionResultsProvider";
import { App } from "@/webview/views/executionResults/App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <IntegrationProvider>
          <ExecutionResultsProvider>
            <App />
          </ExecutionResultsProvider>
        </IntegrationProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
