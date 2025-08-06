import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { CONFIGURE_INSTANCE_PARAMS } from "@/webview/views/configWizard/constants";
import type { ConfigWizardContextValue } from "@/webview/views/configWizard/types";
import { useIntegrationContext } from "@/webview/providers/IntegrationProvider";
import { useAuthContext } from "@/webview/providers/AuthProvider";
import { useWebviewMessage } from "@/webview/hooks/useWebviewMessage";

const ConfigWizardContext = createContext<ConfigWizardContextValue | null>(
  null
);

const MESSAGE_EVENTS = {
  INSTANCE_CONFIGURATION_OPENED: "INSTANCE_CONFIGURATION_OPENED",
  INSTANCE_CONFIGURATION_CLOSED: "INSTANCE_CONFIGURATION_CLOSED",
} as const;

export const ConfigWizardProvider = ({ children }: { children: ReactNode }) => {
  const { prismaticUrl, accessToken } = useAuthContext();
  const { systemInstanceId } = useIntegrationContext();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { postMessage } = useWebviewMessage("configWizard.closed");

  const iframeUrl = useMemo(() => {
    if (!systemInstanceId || !prismaticUrl) {
      return "";
    }

    const params = new URLSearchParams({
      ...CONFIGURE_INSTANCE_PARAMS,
      jwt: accessToken,
    });

    return `${prismaticUrl}/configure-instance/${systemInstanceId}/?${params.toString()}`;
  }, [systemInstanceId, prismaticUrl, accessToken]);

  const handleIframeMessage = useCallback(
    (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const { event: messageEvent } = event.data;

      switch (messageEvent) {
        case MESSAGE_EVENTS.INSTANCE_CONFIGURATION_OPENED:
          setHasLoaded(true);
          break;
        case MESSAGE_EVENTS.INSTANCE_CONFIGURATION_CLOSED:
          setHasLoaded(false);
          postMessage("");
          break;
      }
    },
    [postMessage]
  );

  useEffect(() => {
    window.addEventListener("message", handleIframeMessage);

    return () => {
      window.removeEventListener("message", handleIframeMessage);
      setHasLoaded(false);
    };
  }, [handleIframeMessage]);

  const value = useMemo(
    () => ({
      iframeRef,
      iframeUrl,
      hasLoaded,
    }),
    [iframeUrl, hasLoaded]
  );

  if (!iframeUrl) {
    return null;
  }

  return (
    <ConfigWizardContext.Provider value={value}>
      {children}
    </ConfigWizardContext.Provider>
  );
};

export const useConfigWizardContext = () => {
  const context = useContext(ConfigWizardContext);

  if (!context) {
    throw new Error(
      "useConfigWizardContext must be used within ConfigWizardProvider"
    );
  }

  return context;
};
