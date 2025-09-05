import type { ReactNode } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { GlobalStyle } from "@/webview/providers/theme/GlobalStyle";
import { THEME } from "@/webview/providers/theme/theme";

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  return (
    <StyledThemeProvider theme={THEME}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  );
};
