import styled from "styled-components";

export const Container = styled.div`
  width: 100%;
  height: 100%;
`;

export const Iframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  opacity: 0;
  display: none;
  transition: opacity 0.3s ease-in-out;
  &.has-loaded {
    display: block;
    opacity: 1;
  }
`;
