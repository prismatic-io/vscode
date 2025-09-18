# Prismatic Extension for VSCode & Cursor

An extension for VSCode & Cursor that improves the developer experience around Code-Native Integrations (CNI) by enabling test execution, integration imports, instance configuration, and inspection of execution results directly within the IDE.

## Purpose

The main intent of this extension is to offer:

1. **Seamless Development Workflow Integration:**
   This extension bridges the gap between local development and the Prismatic platform by providing direct access to integration testing, configuration, and debugging tools within your IDE. Instead of constantly switching between your code editor and the Prismatic web interface, developers can manage their entire CNI development lifecycle from VS Code, reducing context switching and improving productivity.

2. **Real-time Testing and Debugging:**
   The extension provides immediate feedback on integration performance through real-time test execution and detailed step-by-step output streaming. This allows developers to quickly identify issues, debug problems, and iterate on their integrations without leaving their development environment, significantly reducing the feedback loop between coding and testing.

3. **Unified Configuration Management:**
   By integrating the Prismatic CLI directly into VS Code, the extension ensures consistent configuration management across different environments and team members. The Config Wizard provides a guided interface for setting up integration instances, while maintaining synchronization with the Prismatic platform, ensuring that local development configurations stay aligned with production environments.

## Features

- **Authentication**: Secure login and token management through the Prismatic CLI.
- **Config Wizard**: Configure integration instances with a guided interface.
- **Execution Results**: View detailed step-by-step outputs and logs.
- **Integration Import**: Direct import of integrations from Prismatic.
- **Message Passing**: Bi-directional communication between webviews and extension.
- **React Integration**: Modern UI components using React and styled-components.
- **State Management**: Persistent state across extension sessions.
- **VSCode Theming**: Seamless integration with VS Code's theme system.

## Prerequisites

- A [Prismatic account](https://prismatic.io).
- The Prismatic CLI installed globally [Prism](https://prismatic.io/docs/cli/#installing-the-cli-tool).
- VSCode [version 1.96.0 or higher](https://code.visualstudio.com/updates/v1_96).
- A [Prismatic Code-Native Integration (CNI) project](https://prismatic.io/docs/integrations/code-native/).

## Usage

The extension provides commands and webview panels that can be accessed through the VS Code command palette:

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Prismatic" to see available commands.

### Available Commands

#### `Prismatic: Config Wizard`
Launches the Config Wizard to edit configuration values for your integration instance.

#### `Prismatic: Import Integration`
Imports the Code-Native Integration (CNI) from your local project into the Prismatic platform.

#### `Prismatic: Test Integration`
Executes a test for the Code-Native Integration (CNI). After the test is complete, it streams step outputs and logs for debugging.

#### `Prismatic: Login`
Logs in to your Prismatic account using your globally installed Prismatic CLI (Prism) then stores your authentication session.

#### `Prismatic: Logout`
Logs out of your Prismatic account using your globally installed Prismatic CLI (Prism) then clears your authentication session.

#### `Prismatic: Prismatic URL`
Sets your systems PRISMATIC_URL environment variable for your Prismatic CLI (Prism) then syncs it to the extension. This allows you to change your Prismatic stack environment.

#### `Prismatic: Me`
Displays details about the currently authenticated Prismatic user, including name, organization, and Prismatic stack environment information using your globally installed Prismatic CLI (Prism).

#### `Prismatic: Refresh Token`
Refreshes your Prismatic authentication token to ensure continued access without needing to logout and log in again using your globally installed Prismatic CLI (Prism).

#### `Prismatic: Focus on Execution Results View`
Displays the results of the Code-Native Integration (CNI) test. This includes the executions, step results (onTrigger and onExecution), and step outputs & logs.

### Available Webviews

#### `Prismatic: Config Wizard`
Displays the Config Wizard to edit configuration values for your integration instance.

#### `Prismatic: Focus on Execution Results View`
Displays the results of the Code-Native Integration (CNI) test. This includes the executions, step results (onTrigger and onExecution), and step outputs & logs.

## Troubleshooting

If you encounter issues with the Prismatic CLI:

1. Ensure the CLI is installed globally: `npm install -g @prismatic-io/prism`
2. Verify the installation: `prism --version`
3. Check your PATH environment variable includes the npm global bin directory
4. Try reinstalling the extension

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
