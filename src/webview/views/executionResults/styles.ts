import styled from "styled-components";
import {
  ContainerBase,
  TitleBase,
  TextBase,
  ButtonBase,
} from "@/webview/lib/theme/base";

export const Container = styled(ContainerBase)``;

export const Title = styled(TitleBase)``;

export const Message = styled(TextBase)``;

export const LastMessage = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

export const Button = styled(ButtonBase)``;
