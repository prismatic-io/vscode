import styled from "styled-components";
import { THEME } from "@/webview/providers/theme/theme";

export const ContainerBase = styled.div`
  padding: ${THEME.spacing.medium};
  color: ${THEME.colors.sidebarForeground};
  background-color: ${THEME.colors.sidebarBackground};
  font-family: ${THEME.typography.fontFamily};
  font-size: ${THEME.typography.baseSize};
`;

export const TitleBase = styled.h1`
  color: ${THEME.colors.title};
  margin-bottom: ${THEME.spacing.medium};
`;

export const TextBase = styled.p`
  margin-bottom: ${THEME.spacing.medium};
  line-height: 1.5;
`;

export const ButtonBase = styled.button`
  padding: ${THEME.spacing.small} ${THEME.spacing.medium};
  background-color: ${THEME.colors.primary};
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: ${THEME.typography.baseSize};
  font-family: ${THEME.typography.fontFamily};
  transition: background-color ${THEME.transitions.default};
  &:hover {
    background-color: ${THEME.colors.primaryHover};
  }
  &:focus {
    outline: none;
    background-color: ${THEME.colors.primaryHover};
  }
`;
