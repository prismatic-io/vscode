# Prismatic VS Code Extension

A VS Code extension that improves the developer experience around Code Native Integrations (CNI) by enabling test execution, integration imports, instance configuration, and inspection of execution results directly within the IDE.

## Features

- **Configuration Wizard**: Configure integration instances with a guided interface
- **Execution Results**: View detailed step-by-step outputs and logs
- **React Integration**: Modern UI components using React and styled-components
- **VS Code Theming**: Seamless integration with VS Code's theme system
- **State Management**: Persistent state across extension sessions
- **Message Passing**: Bidirectional communication between webviews and extension

## Getting Started

1. Install the extension
2. Open the Prismatic view in the Activity Bar
3. Use the Configuration Wizard to set up your integration
4. View execution results in the panel

## Development

### Prerequisites

- Node.js
- VS Code
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run build
```

4. Run in development mode:

```bash
npm run dev
```

### Project Structure

```
src/
  ├── components/        # Shared React components
  ├── hooks/            # Custom React hooks
  │   └── useWebviewMessage.ts
  ├── providers/        # VS Code providers
  │   ├── PanelProvider.ts
  │   └── WebviewProvider.ts
  ├── theme/           # Theme configuration
  │   ├── ThemeProvider.tsx
  │   ├── GlobalStyle.ts
  │   └── theme.ts
  ├── typeDefs/        # TypeScript type definitions
  │   ├── messages.ts
  │   └── state.ts
  ├── utils/           # Utility functions
  │   └── stateManager.ts
  ├── views/           # View-specific components
  │   ├── configWizard/
  │   ├── executionResults/
  │   └── prismatic/
  └── extension.ts     # Extension entry point
```

### Available Commands

- `prismatic.configWizard`: Open the Configuration Wizard
- `prismatic.executionResults`: View execution results
- `prismatic.settings`: Open Prismatic settings

### Building

The project uses esbuild for bundling:

- Extension code is bundled to `dist/extension.js`
- Webview components are bundled to their respective `dist/*View` directories
- Styles are handled by styled-components

## Usage

The extension provides a webview panel that can be accessed through the VS Code command palette:

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Prismatic" to see available commands
3. Select "Show Prismatic Panel" to open the webview

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
