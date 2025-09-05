import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/webview/providers/AuthProvider";
import { IntegrationProvider } from "@/webview/providers/IntegrationProvider";
import { ThemeProvider } from "@/webview/providers/theme/ThemeProvider";
import { App } from "@/webview/views/configWizard/App";
import { ConfigWizardProvider } from "@/webview/views/configWizard/providers/ConfigWizardProvider";

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
          <ConfigWizardProvider>
            <App />
          </ConfigWizardProvider>
        </IntegrationProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
