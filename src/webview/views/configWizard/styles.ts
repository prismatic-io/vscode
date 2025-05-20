import styled from "styled-components";

export const Container = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const Title = styled.h1`
  font-size: 24px;
  margin: 0;
`;

export const Message = styled.div`
  font-size: 16px;
  color: var(--vscode-foreground);
`;

export const LastMessage = styled.div`
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
`;

export const Button = styled.button`
  padding: 8px 16px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  &:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
`;
