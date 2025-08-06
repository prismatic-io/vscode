import type React from "react";
import { Container, Iframe } from "@/webview/views/configWizard/styles";
import { useConfigWizardContext } from "@/webview/views/configWizard/providers/ConfigWizardProvider";
import { LoadingSpinner } from "@/webview/components/LoadingSpinner";

export const App: React.FC = () => {
  const { iframeRef, iframeUrl, hasLoaded } = useConfigWizardContext();

  return (
    <Container>
      {!hasLoaded ? <LoadingSpinner size={40} /> : null}
      <Iframe
        className={hasLoaded ? "has-loaded" : ""}
        ref={iframeRef}
        src={iframeUrl}
        title="Config Wizard"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </Container>
  );
};
