import "styled-components";

declare module "styled-components" {
  export interface DefaultTheme {
    colors: {
      background: string;
      border: string;
      primary: string;
      primaryHover: string;
      secondary: string;
      sidebarBackground: string;
      sidebarForeground: string;
      sidebarBorder: string;
      sidebarSectionHeaderBackground: string;
      sidebarSectionHeaderForeground: string;
      sidebarSectionHeaderBorder: string;
      sidebarTitle: string;
      sidebarTitleBackground: string;
      sidebarTitleBorder: string;
      text: string;
      title: string;
      icon: string;
      error: string;
      info: string;
      success: string;
      warning: string;
    };
    borderRadius: string;
    spacing: {
      small: string;
      medium: string;
      large: string;
    };
    typography: {
      fontFamily: string;
      baseSize: string;
      headingSize: string;
      monospace: string;
    };
    transitions: {
      default: string;
    };
  }
}
