import styled from "styled-components";
import { ContainerBase, TextBase } from "@/webview/providers/theme/base";

export const NotLoggedIn: React.FC = () => {
  return (
    <Container>
      <TextContainer>
        Please log in to use Prismatic. Open the command palette (Cmd/Ctrl +
        Shift + P) and type "Prismatic: Login" to get started.
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
  margin: 0;
  max-width: 400px;
  padding: ${({ theme }) => theme.spacing.medium};
  text-align: center;
`;
