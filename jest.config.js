module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@extension/(.*)$": "<rootDir>/src/extension/$1",
    "^@webview/(.*)$": "<rootDir>/src/webview/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
};
