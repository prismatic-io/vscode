import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/webview/views/configWizard/App";
import { ThemeProvider } from "@/webview/providers/theme/ThemeProvider";
import { AuthProvider } from "@/webview/providers/AuthProvider";
import { ConfigWizardProvider } from "@/webview/views/configWizard/providers/ConfigWizardProvider";
import { IntegrationProvider } from "@/webview/providers/IntegrationProvider";

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
  </React.StrictMode>
);
