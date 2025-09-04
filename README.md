# Prismatic VS Code Extension

A VS Code extension that improves the developer experience around Code Native Integrations (CNI) by enabling test execution, integration imports, instance configuration, and inspection of execution results directly within the IDE.

## Features

- **Authentication**: Secure login and token management through the Prismatic CLI
- **Config Wizard**: Configure integration instances with a guided interface
- **Execution Results**: View detailed step-by-step outputs and logs
- **Integration Import**: Direct import of integrations from Prismatic
- **Message Passing**: Bi-directional communication between webviews and extension
- **React Integration**: Modern UI components using React and styled-components
- **State Management**: Persistent state across extension sessions
- **VSCode Theming**: Seamless integration with VS Code's theme system

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Install the Prismatic CLI globally:
   ```bash
   npm install -g @prismatic-io/prism
   ```
   Note: The extension will also work with a local installation of the CLI, but a global installation is recommended for the best experience.
3. Open the Prismatic view in the Activity Bar
4. Log in to your Prismatic instance
5. Use the Config Wizard to set up your integration
6. View execution results in the panel

## Development

### Prerequisites

- Node.js
- VS Code (version 1.96.0 or higher)
- npm or yarn
- Prismatic CLI (installed globally)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run build:prod
```

4. Run in development mode:

```bash
npm run watch
```

### Project Structure

```
src/
  ├── extension/      # VS Code extension code
  ├── lib/            # Utility functions and shared code
  ├── webview/        # React webview components
  ├── types/          # TypeScript type definitions
  └── extension.ts    # Extension entry point
```

### Available Commands

- `prismatic.configWizard`: Open the Config Wizard
- `prismatic.me`: View your user profile
- `prismatic.refreshToken`: Refresh your authentication token
- `prismatic.login`: Log in to Prismatic
- `prismatic.logout`: Log out of Prismatic
- `prismatic.integrations.import`: Import an integration
- `prismatic.integrations.test`: Test the actively selected flow of an integration
- `prismatic.prismaticUrl`: Set your Prismatic instance URL

### Building

The project uses esbuild for bundling:

- Extension code is bundled to `extension/extension.js`
- Webview components are bundled to their respective directories
- Styles are handled by styled-components and use the VSCode theme

## Usage

The extension provides a commands and a webview panel that can be accessed through the VS Code command palette:

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Prismatic" to see available commands

## Installing the extension (.vsix) for development

Please note that the extension is not yet published to the VS Code Marketplace, so you will need to install it manually. Please request access to the vsix file from the extension maintainers.

### VSCode

How to install a VSIX extension in VS Code

1. **Open Visual Studio Code.**
2. **Go to the Extensions view:**
   - Click the Extensions icon in the Activity Bar on the side (it looks like four squares).
   - Or press Ctrl+Shift+X (Windows/Linux) or Cmd+Shift+X (Mac).
3. **Open the Extension Menu:**
   - Click the three-dot menu (⋮) in the top-right corner of the Extensions view.
4. **Select "Install from VSIX..."**
   - In the dropdown menu, click on **Install from VSIX...**.
5. **Choose Your VSIX File:**
   - In the file dialog, navigate to the location of your .vsix file.
   - Select the file.
   - Click **Open**.
6. **Wait for Installation:**
   - VS Code will install the extension.
   - If prompted, click **Reload** or **Restart** VS Code to activate the extension.

### Cursor

How to install a VSIX extension in Cursor

1. **Open Cursor.**
2. **Open Command Palette** (`Ctrl/Cmd+Shift+P`)
3. **Type** "Extensions: Install from VSIX..."
4. **Select** **Your VSIX File:**
   - In the file dialog, navigate to the location of your `.vsix` file.
   - Select the file.
   - Click **Open**.
5. **Complete Installation:**
   - Wait for Cursor to install the extension. You may need to reload or restart Cursor to activate it.

## Troubleshooting

If you encounter issues with the Prismatic CLI:

1. Ensure the CLI is installed globally: `npm install -g @prismatic-io/prism`
2. Verify the installation: `prism --version`
3. Check your PATH environment variable includes the npm global bin directory
4. Try reinstalling the extension

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
