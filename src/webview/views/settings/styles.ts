import styled from "styled-components";
import {
  ContainerBase,
  TitleBase,
  TextBase,
  ButtonBase,
} from "@webview/lib/theme/base";
import { THEME } from "@webview/lib/theme/theme";

export const Container = styled(ContainerBase)`
  background-color: ${THEME.colors.sidebarBackground};
  border-right: 1px solid ${THEME.colors.sidebarBorder};
  border-top: 1px solid ${THEME.colors.sidebarSectionHeaderBorder};
  color: ${THEME.colors.sidebar};
  height: 100vh;
  margin: 0;
  max-width: 100vw;
  min-height: 100vh;
  overflow: hidden;
  width: 100vw;
`;

export const Title = styled(TitleBase)``;

export const Message = styled(TextBase)``;

export const LastMessage = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

export const Button = styled(ButtonBase)``;
