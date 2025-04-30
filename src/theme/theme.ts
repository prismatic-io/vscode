import type { DefaultTheme } from "styled-components";

export const THEME: DefaultTheme = {
  colors: {
    background: "var(--vscode-editor-background)",
    border: "var(--vscode-input-border)",
    primary: "var(--vscode-button-background)",
    primaryHover: "var(--vscode-button-hoverBackground)",
    secondary: "var(--vscode-descriptionForeground)",
    sidebarSectionHeader: "var(--vscode-sideBarSectionHeader-foreground)",
    sidebarSectionHeaderBackground:
      "var(--vscode-sideBarSectionHeader-background)",
    sidebarSectionHeaderBorder: "var(--vscode-sideBarSectionHeader-border)",
    sidebarBackground: "var(--vscode-sideBar-background)",
    sidebarBorder: "var(--vscode-sideBar-border)",
    sidebar: "var(--vscode-sideBar-foreground)",
    sidebarTitle: "var(--vscode-sideBarTitle-foreground)",
    sidebarTitleBackground: "var(--vscode-sideBarTitle-background)",
    sidebarTitleBorder: "var(--vscode-sideBarTitle-border)",
    text: "var(--vscode-foreground)",
    title: "var(--vscode-titleBar-activeForeground)",
  },
  spacing: {
    small: "8px",
    medium: "16px",
    large: "24px",
  },
  typography: {
    fontFamily: "var(--vscode-font-family)",
    fontSize: "var(--vscode-font-size)",
  },
  transitions: {
    default: "0.1s ease-in-out",
  },
};
