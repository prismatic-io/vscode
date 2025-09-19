# Prismatic Extension for VSCode & Cursor

An extension for VSCode & Cursor that improves the developer experience around Code-Native Integrations (CNI) by enabling test execution, integration imports, instance configuration, and inspection of execution results directly within the IDE.

## What is Prismatic?

Prismatic is the leading embedded iPaaS, enabling B2B SaaS teams to ship product integrations faster and with less dev time. The only embedded iPaaS that empowers both developers and non-developers with tools for the complete integration lifecycle, Prismatic includes low-code and code-native building options, deployment and management tooling, and self-serve customer tools.

Prismatic's unparalleled versatility lets teams deliver any integration from simple to complex in one powerful platform. SaaS companies worldwide, from startups to Fortune 500s, trust Prismatic to help connect their products to the other products their customers use.

With Prismatic, you can:

- Build [integrations](https://prismatic.io/docs/integrations/) using our [intuitive low-code designer](https://prismatic.io/docs/integrations/low-code-integration-designer/) or [code-native](https://prismatic.io/docs/integrations/code-native/) approach in your preferred IDE
- Leverage pre-built [connectors](https://prismatic.io/docs/components/) for common integration tasks, or develop custom connectors using our TypeScript SDK
- Embed a native [integration marketplace](https://prismatic.io/docs/embed/) in your product for customer self-service
- Configure and deploy customer-specific integration instances with powerful configuration tools
- Support customers efficiently with comprehensive [logging, monitoring, and alerting](https://prismatic.io/docs/monitor-instances/)
- Run integrations in a secure, scalable infrastructure designed for B2B SaaS
- Customize the platform to fit your product, industry, and development workflows

## Who uses Prismatic?

Prismatic is built for B2B software companies that need to provide integrations to their customers. Whether you're a growing SaaS startup or an established enterprise, Prismatic's platform scales with your integration needs.

Our platform is particularly powerful for teams serving specialized vertical markets. We provide the flexibility and tools to build exactly the integrations your customers need, regardless of the systems you're connecting to or how unique your integration requirements may be.

## What kind of integrations can you build using Prismatic?

Prismatic supports integrations of any complexity - from simple data syncs to sophisticated, industry-specific solutions. Teams use it to build integrations between any type of system, whether modern SaaS or legacy with standard or custom protocols. Here are some example use cases:

- Connect your product with customers' ERPs, CRMs, and other business systems
- Process data from multiple sources with customer-specific transformation requirements
- Automate workflows with customizable triggers, actions, and schedules
- Handle complex authentication flows and data mapping scenarios

For information on the Prismatic platform, check out our [website](https://prismatic.io/) and [docs](https://prismatic.io/docs/).

## Extension Purpose

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

<img width="756" height="311" alt="Image" src="https://github.com/user-attachments/assets/e29b9214-6364-4499-a178-1b4fa35a4c68" />

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

#### `Prismatic: Focus on Execution Results View`
Displays the results of the Code-Native Integration (CNI) test. This includes the executions, step results (onTrigger and onExecution), and step outputs & logs.

<img width="2189" height="725" alt="Image" src="https://github.com/user-attachments/assets/7e148ee9-980b-41cc-ab04-8022d8b2e840" />

#### `Prismatic: Config Wizard`
Displays the Config Wizard to edit configuration values for your integration instance.

<img width="1600" height="1536" alt="Image" src="https://github.com/user-attachments/assets/39f3c767-48a1-4001-b218-d00e9ce001bc" />

## Troubleshooting

If you encounter issues with the Prismatic CLI:

1. Ensure the CLI is installed globally: `npm install -g @prismatic-io/prism`
2. Verify the installation: `prism --version`
3. Check your PATH environment variable includes the npm global bin directory
4. Try reinstalling the extension

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
