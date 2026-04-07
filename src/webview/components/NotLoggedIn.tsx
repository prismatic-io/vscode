import { messageHandlerManager } from "@extension/MessageHandlerManager";
import styled from "styled-components";
import {
  ButtonBase,
  ContainerBase,
  TextBase,
} from "@/webview/providers/theme/base";

export const NotLoggedIn: React.FC = () => {
  const handleLogin = () => {
    messageHandlerManager.postMessage({
      type: "requestLogin",
      payload: undefined,
    });
  };

  return (
    <Container>
      <TextContainer>
        <p>Log in to Prismatic to get started.</p>
        <LoginButton type="button" onClick={handleLogin}>
          Login to Prismatic
        </LoginButton>
      </TextContainer>
    </Container>
  );
};

const Container = styled(ContainerBase)`
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  padding: 0;
`;

const TextContainer = styled(TextBase)`
  background-color: ${({ theme }) =>
    theme.colors.sidebarSectionHeaderBackground};
  border-radius: ${({ theme }) => theme.borderRadius};
  color: ${({ theme }) => theme.colors.sidebarSectionHeaderForeground};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.small};
  margin: 0;
  max-width: 400px;
  padding: ${({ theme }) => theme.spacing.medium};
  text-align: center;
`;

const LoginButton = styled(ButtonBase)`
  width: auto;
`;
