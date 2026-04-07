import { messageHandlerManager } from "@extension/MessageHandlerManager";
import type { MessageType } from "@type/messages";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LoadingSpinner } from "@/webview/components/LoadingSpinner";
import { NotLoggedIn } from "@/webview/components/NotLoggedIn";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";

const AuthContext = createContext<{
  accessToken: string;
  prismaticUrl: string;
} | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);

  const { state: globalState, hasLoaded: hasLoadedGlobalState } =
    useVSCodeState({
      scope: "global",
    });

  const { hasLoaded: hasLoadedWorkspaceState } = useVSCodeState({
    scope: "workspace",
  });

  // Request access token from extension
  const requestToken = useCallback(() => {
    messageHandlerManager.postMessage({
      type: "requestAccessToken",
      payload: undefined,
    });
  }, []);

  // Request token on mount
  useEffect(() => {
    requestToken();
  }, [requestToken]);

  // Listen for token responses and auth state changes
  useEffect(() => {
    const handleMessage = (message: MessageType) => {
      if (message.type === "accessToken") {
        setAccessToken(message.payload.token);
        setTokenLoaded(true);
      }
      if (message.type === "authStateChanged") {
        requestToken();
      }
    };

    messageHandlerManager.on("accessToken", handleMessage);
    messageHandlerManager.on("authStateChanged", handleMessage);

    return () => {
      messageHandlerManager.off("accessToken", handleMessage);
      messageHandlerManager.off("authStateChanged", handleMessage);
    };
  }, [requestToken]);

  const value = useMemo(() => {
    if (!accessToken || !globalState?.prismaticUrl) {
      return null;
    }

    return {
      accessToken,
      prismaticUrl: globalState.prismaticUrl,
    };
  }, [accessToken, globalState]);

  if (!hasLoadedGlobalState || !hasLoadedWorkspaceState || !tokenLoaded) {
    return <LoadingSpinner size={40} />;
  }

  if (!value) {
    return <NotLoggedIn />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
