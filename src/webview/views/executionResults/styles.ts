import styled from "styled-components";
import { ContainerBase } from "@/webview/providers/theme/base";

export const Container = styled(ContainerBase)`
  padding: 0;
  height: 100%;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: 100%;
  height: 100%;

  .column {
    border-right: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
    display: flex;
    flex-direction: column;
    max-width: 100%;
    min-width: 0;
    height: 100%;
    overflow: auto;

    &:last-child {
      border-right: none;
    }
  }

  .column__header {
    background-color: ${({ theme }) =>
      theme.colors.sidebarSectionHeaderBackground};
    color: ${({ theme }) => theme.colors.sidebarSectionHeaderForeground};
    font-family: ${({ theme }) => theme.typography.fontFamily};
    font-size: ${({ theme }) => theme.typography.headingSize};
    margin: 0;
    padding: ${({ theme }) => theme.spacing.small};
  }

  .column__header__tabs {
    background-color: ${({ theme }) =>
      theme.colors.sidebarSectionHeaderBackground};
    border-bottom: 1px solid ${({ theme }) => theme.colors.sidebarBorder};
    color: ${({ theme }) => theme.colors.sidebarSectionHeaderForeground};
    margin: 0;
    padding: ${({ theme }) => theme.spacing.small};

    button {
      background: none;
      border-radius: 0;
      border: none;
      color: ${({ theme }) => theme.colors.sidebarSectionHeaderForeground};
      cursor: pointer;
      font-family: ${({ theme }) => theme.typography.fontFamily};
      font-size: ${({ theme }) => theme.typography.headingSize};
      font-weight: 700;
      margin: 0;
      margin-right: ${({ theme }) => theme.spacing.medium};
      opacity: 0.6;
      outline: none;
      padding: 0;
      position: relative;
      transition: background-color 0.1s ease-in-out;

      &:hover {
        opacity: 1;
      }

      &.is-active {
        opacity: 1;
        &::after {
          background-color: ${({ theme }) => theme.colors.secondary};
          bottom: -7px;
          content: "";
          display: block;
          height: 1px;
          left: 0;
          position: absolute;
          width: 100%;
        }
      }
    }
  }

  .column__body__select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-color: var(--vscode-dropdown-background);
    background-image: url("data:image/svg+xml;utf8,<svg fill='%23cccccc' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
    background-position-x: calc(100% - ${({ theme }) => theme.spacing.small});
    background-position-y: 4px;
    background-repeat: no-repeat;
    border-radius: ${({ theme }) => theme.borderRadius};
    border: none;
    color: var(--vscode-dropdown-foreground);
    display: block;
    padding: ${({ theme }) => theme.spacing.small};
    padding-right: 40px;
    width: 100%;

    &:hover,
    &:focus {
      background-color: ${({ theme }) =>
        theme.colors.sidebarSectionHeaderBackground};
      border-color: ${({ theme }) => theme.colors.sidebarBorder};
      outline: none;
    }
  }

  .column__body {
    font-size: ${({ theme }) => theme.typography.baseSize};
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.small};
  }

  .column__body__empty {
    background: ${({ theme }) => theme.colors.sidebarSectionHeaderBackground};
    border-radius: ${({ theme }) => theme.borderRadius};
    color: ${({ theme }) => theme.colors.sidebarSectionHeaderForeground};
    font-size: ${({ theme }) => theme.typography.baseSize};
    margin: 0;
    padding: ${({ theme }) => theme.spacing.medium};
  }

  /* Executions */
  .column--executions .column__body {
    display: flex;
    flex-direction: column;
  }

  .column--executions__button {
    align-items: center;
    background: none;
    border-radius: ${({ theme }) => theme.borderRadius};
    border: none;
    box-shadow: none;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: ${({ theme }) => theme.spacing.small};
    justify-content: flex-start;
    margin: 0;
    outline: none;
    padding: ${({ theme }) => theme.spacing.small};
    transition: background-color 0.1s ease-in-out;

    &:hover,
    &.column--executions__button--active {
      background-color: ${({ theme }) =>
        theme.colors.sidebarSectionHeaderBackground};
    }
  }

  .column--executions__button__status {
    align-items: center;
    background-color: ${({ theme }) => theme.colors.primary};
    border-radius: 4px;
    display: flex;
    height: 100%;
    justify-content: center;
    min-height: 24px;
    width: 4px;

    &[data-status="success"] {
      background-color: ${({ theme }) => theme.colors.success};
    }

    &[data-status="failed"] {
      background-color: ${({ theme }) => theme.colors.error};
    }

    &[data-status="pending"] {
      background-color: ${({ theme }) => theme.colors.info};
    }
  }

  .column--executions__button__icon {
    align-items: center;
    display: flex;
    grid-column: 2;
    height: 18px;
    justify-content: center;
    width: 18px;

    svg {
      width: 100%;
      height: 100%;
    }

    svg path {
      fill: ${({ theme }) => theme.colors.text};
    }
  }

  .column--executions__button__text {
    flex: 1;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .column--executions__button__duration {
    margin-left: auto;
  }

  /* Step Results */
  .column--step-results .column__body {
    display: flex;
    flex-direction: column;
  }

  .column--step-results__button {
    align-items: center;
    background: none;
    border-radius: ${({ theme }) => theme.borderRadius};
    border: none;
    box-shadow: none;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: ${({ theme }) => theme.spacing.small};
    justify-content: flex-start;
    margin: 0;
    outline: none;
    padding: ${({ theme }) => theme.spacing.small};
    transition: background-color 0.1s ease-in-out;

    &:hover,
    &.column--step-results__button--active {
      background-color: ${({ theme }) =>
        theme.colors.sidebarSectionHeaderBackground};
    }
  }

  .column--step-results__button__status {
    width: 4px;
    height: 100%;
    min-height: 24px;
    background-color: ${({ theme }) => theme.colors.primary};
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;

    &[data-status="success"] {
      background-color: ${({ theme }) => theme.colors.success};
    }

    &[data-status="failed"] {
      background-color: ${({ theme }) => theme.colors.error};
    }
  }

  .column--step-results__button__text {
    flex: 1;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .column--step-results__button__duration {
    margin-left: auto;
  }

  /* Step Outputs */
  .column--step-outputs .column__body {
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.small};
    padding: ${({ theme }) => theme.spacing.small};
  }

  .column--step-outputs__message {
    background: ${({ theme }) => theme.colors.sidebarSectionHeaderBackground};
    border-radius: ${({ theme }) => theme.borderRadius};
    color: ${({ theme }) => theme.colors.sidebarSectionHeaderForeground};
    font-size: ${({ theme }) => theme.typography.baseSize};
    margin: 0;
    padding: ${({ theme }) => theme.spacing.medium};
  }

  /* Step Outputs Output */
  .column--step-outputs__output {
    pre {
      margin: 0;
      background-color: ${({ theme }) => theme.colors.background};
      border-radius: ${({ theme }) => theme.borderRadius};
      padding: ${({ theme }) => theme.spacing.medium};
    }

    code {
      background: transparent;
      font-size: 0.65rem;
      font-family: ${({ theme }) => theme.typography.monospace};
      line-height: 2;
    }
  }

  /* Step Outputs Logs */
  .column--step-outputs__logs {
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.small};
  }

  .column--step-outputs__log {
    align-items: center;
    background-color: ${({ theme }) =>
      theme.colors.sidebarSectionHeaderBackground};
    border-radius: ${({ theme }) => theme.borderRadius};
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: ${({ theme }) => theme.spacing.small};
    justify-content: flex-start;
    margin: 0;
    padding: ${({ theme }) => theme.spacing.small};
  }

  .column--step-outputs__log__severity {
    background-color: ${({ theme }) => theme.colors.primary};
    border-radius: 4px;
    height: 100%;
    min-height: 24px;
    width: 4px;

    &[data-severity="DEBUG"] {
      background-color: ${({ theme }) => theme.colors.info};
    }

    &[data-severity="INFO"] {
      background-color: ${({ theme }) => theme.colors.info};
    }

    &[data-severity="WARN"] {
      background-color: ${({ theme }) => theme.colors.warning};
    }

    &[data-severity="ERROR"] {
      background-color: ${({ theme }) => theme.colors.error};
    }

    &[data-severity="FATAL"] {
      background-color: ${({ theme }) => theme.colors.error};
    }

    &[data-severity="METRIC"] {
      background-color: ${({ theme }) => theme.colors.info};
    }

    &[data-severity="TRACE"] {
      background-color: ${({ theme }) => theme.colors.info};
    }
  }

  .column--step-outputs__log__text {
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.small};
  }

  .column--step-outputs__log__text__time {
  }

  .column--step-outputs__log__text__message {
    font-size: 0.8rem;
  }
`;
