import styled, { keyframes } from "styled-components";

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export const LoadingSpinner = ({
  className,
  size = 30,
}: LoadingSpinnerProps) => {
  return (
    <SpinnerContainer className={className}>
      <Spinner role="status" aria-label="Loading" size={size} />
    </SpinnerContainer>
  );
};

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const SpinnerContainer = styled.div`
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
`;

const Spinner = styled.div<{ size: number }>`
  animation: ${spin} 1s linear infinite;
  border-radius: 50%;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top: 3px solid ${({ theme }) => theme.colors.primary};
  height: ${({ size }) => size}px;
  width: ${({ size }) => size}px;
`;
