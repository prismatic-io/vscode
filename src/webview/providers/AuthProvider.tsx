import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { LoadingSpinner } from "@/webview/components/LoadingSpinner";
import { NotLoggedIn } from "@/webview/components/NotLoggedIn";
import { useVSCodeState } from "@/webview/hooks/useVSCodeState";

const AuthContext = createContext<{
  accessToken: string;
  prismaticUrl: string;
} | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const { state: globalState, hasLoaded: hasLoadedGlobalState } =
    useVSCodeState({
      scope: "global",
    });

  const { hasLoaded: hasLoadedWorkspaceState } = useVSCodeState({
    scope: "workspace",
  });

  const value = useMemo(() => {
    if (!globalState?.accessToken || !globalState?.prismaticUrl) {
      return null;
    }

    return {
      accessToken: globalState.accessToken,
      prismaticUrl: globalState.prismaticUrl,
    };
  }, [globalState]);

  if (!hasLoadedGlobalState || !hasLoadedWorkspaceState) {
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
