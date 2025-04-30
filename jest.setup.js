import "@testing-library/jest-dom";

// Mock the VS Code API
global.acquireVsCodeApi = () => ({
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn(),
});
