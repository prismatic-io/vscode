import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  body {
    padding: 0;
    margin: 0;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
  }
  #root {
    // height: 100vh;
  }
`;
