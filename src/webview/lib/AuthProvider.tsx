import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { useVSCodeState } from "@/webview/lib/useVSCodeState";

const AuthContext = createContext<{
  accessToken: string;
  prismaticUrl: string;
} | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const { state: accessToken } = useVSCodeState({
    key: "accessToken",
    scope: "global",
  });

  const { state: prismaticUrl } = useVSCodeState({
    key: "prismaticUrl",
    scope: "global",
  });

  const value = useMemo(() => {
    if (!accessToken || !prismaticUrl) {
      return null;
    }

    return {
      accessToken,
      prismaticUrl,
    };
  }, [accessToken, prismaticUrl]);

  if (!value) {
    return null;
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
