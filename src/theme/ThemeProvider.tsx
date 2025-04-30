import type { ReactNode } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { THEME } from "@theme/theme";
import { GlobalStyle } from "./GlobalStyle";

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
