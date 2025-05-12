import "styled-components";

declare module "styled-components" {
  export interface DefaultTheme {
    colors: {
      background: string;
      border: string;
      primary: string;
      primaryHover: string;
      secondary: string;
      sidebarSectionHeader: string;
      sidebarSectionHeaderBackground: string;
      sidebarSectionHeaderBorder: string;
      sidebarBackground: string;
      sidebarBorder: string;
      sidebar: string;
      sidebarTitle: string;
      sidebarTitleBackground: string;
      sidebarTitleBorder: string;
      text: string;
      title: string;
    };
    spacing: {
      small: string;
      medium: string;
      large: string;
    };
    typography: {
      fontFamily: string;
      fontSize: string;
    };
    transitions: {
      default: string;
    };
  }
}
