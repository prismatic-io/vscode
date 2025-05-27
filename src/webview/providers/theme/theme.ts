import type { DefaultTheme } from "styled-components";

export const THEME: DefaultTheme = {
  colors: {
    background: "var(--vscode-editor-background)",
    border: "var(--vscode-input-border)",
    primary: "var(--vscode-button-background)",
    primaryHover: "var(--vscode-button-hoverBackground)",
    secondary: "var(--vscode-descriptionForeground)",
    sidebarBackground: "var(--vscode-sideBar-background)",
    sidebarForeground: "var(--vscode-sideBar-foreground)",
    sidebarBorder: "var(--vscode-sideBar-border)",
    sidebarSectionHeaderBackground:
      "var(--vscode-sideBarSectionHeader-background)",
    sidebarSectionHeaderForeground:
      "var(--vscode-sideBarSectionHeader-foreground)",
    sidebarSectionHeaderBorder: "var(--vscode-sideBarSectionHeader-border)",
    sidebarTitle: "var(--vscode-sideBarTitle-foreground)",
    sidebarTitleBackground: "var(--vscode-sideBarTitle-background)",
    sidebarTitleBorder: "var(--vscode-sideBarTitle-border)",
    text: "var(--vscode-foreground)",
    title: "var(--vscode-titleBar-activeForeground)",
    icon: "var(--vscode-icon-foreground)",
    error: "#FF0000", // var(--vscode-inputValidation-errorForeground),
    info: "#6F7283", // var(--vscode-inputValidation-infoForeground),
    success: "#2ECE95",
    warning: "#FBC12D", // var(--vscode-inputValidation-warningForeground)",
  },
  borderRadius: "var(--vscode-borderRadius)",
  spacing: {
    small: "8px",
    medium: "16px",
    large: "24px",
  },
  typography: {
    baseSize: "var(--vscode-font-size-base)", // "var(--vscode-font-size)",
    headingSize: "var(--vscode-font-size-heading)",
    fontFamily: "var(--vscode-font-family)",
    monospace: "var(--vscode-editor-font-family)",
  },
  transitions: {
    default: "0.1s ease-in-out",
  },
};
