# Contributing to Prismatic VS Code Extension

This guide is for internal Prismatic developers working on the VS Code extension.

## Prerequisites

- **Node.js**: Version specified in `mise.toml` (currently 22.11.0)
- **VS Code**: Version 1.96.0 or higher
- **mise**: Installed globally for Node.js version management (recommended)
- **Prismatic CLI**: Installed globally (`npm install -g @prismatic-io/prism`)
- **Git**: For version control

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/prismatic-io/vscode.git
cd vscode

# Install dependencies
npm install
```

### 2. Environment Setup

The project uses mise for Node.js version management. If you don't have mise installed globally:

```bash
# Install mise globally (if not already installed)
# See: https://mise.jdx.dev/getting-started.html

# Install the correct Node.js version for this project
mise install

# Verify Node.js version
node --version  # Should show 22.11.0
```

### 3. Build and Development

```bash
# Build for production
npm run build:prod

# Start development mode with watch
npm run watch

# Run type checking
npm run check-types

# Format code
npm run format:fix

# Lint code
npm run lint:fix

# Lint, Format, and Check (assist code fixes)
npm run check:fix
```


### 4. Build VSIX
```bash
# Package as VSIX
npm run package
```

## Project Structure

```
src/
├── extension/                 # VS Code extension core
│   ├── AuthManager.ts         # Authentication management
│   ├── StateManager.ts        # Extension state management
│   ├── PrismCLIManager.ts     # Prism CLI integration
│   ├── WebviewPanelManager.ts # Webview panel management
│   ├── WebviewViewManager.ts  # Webview view management
│   ├── lib/                   # Utility functions
│   └── machines/              # XState state machines
├── webview/                   # React webview components
│   ├── components/            # Reusable React components
│   ├── views/                 # Main webview views
│   ├── providers/             # React context providers
│   └── hooks/                 # Custom React hooks
├── shared/                    # Shared utilities
├── types/                     # TypeScript definitions
└── extension.ts               # Extension entry point
```

## Development Workflow

### 1. Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Start development mode**:
   ```bash
   npm run watch
   ```

3. **Make your changes** in the `src/` directory

4. **Test your changes** using the extension host

### 2. Testing Your Changes

#### Extension Host Testing
1. Open the project in VS Code
2. Press `F5` to launch a new Extension Development Host window
3. Test your changes in the new window

### 3. Code Quality

Before committing, ensure:

```bash
# Type checking
npm run check-types

# Linting and formatting
npm run check:fix

# Build verification
npm run build:prod
```

### 4. Commit Message Conventions

Use conventional commits for better automated changelog generation:

```bash
# Format: type(scope): description
git commit -m "feat(auth): add token refresh functionality"
git commit -m "fix(webview): resolve execution results display issue"
git commit -m "docs(readme): update installation instructions"
git commit -m "chore(deps): update dependencies"
```

**Commit Types:**
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates
- `perf`: Performance improvements
- `ci`: CI/CD changes

### 5. Building

The project uses esbuild for bundling:

- **Extension code**: Bundled to `extension/extension.js`
- **Webview components**: Bundled to `dist/` directories
- **Styles**: Handled by styled-components with VS Code theme integration
- **TypeScript**: Compiled and type-checked

## Debugging and Development

### Extension Host Development

For active development, use the Extension Development Host:

1. **Open the project in VS Code**
2. **Press `F5`** or go to Run → Start Debugging
3. **A new VS Code window opens** with your extension loaded
4. **Make changes** in the original window
5. **Reload the extension** using `Ctrl+R` (or `Cmd+R` on Mac) in the Extension Development Host window

### Debugging Tips

- **Console logs**: Use `console.log()` in extension code - they appear in the Debug Console
- **Webview debugging**: Right-click in webview → "Inspect Element" for React DevTools
- **State inspection**: Use VS Code's debugger to inspect XState machines
- **CLI debugging**: Check terminal output for Prismatic CLI interactions

### Common Issues

1. **Extension not loading**: Check the Debug Console or the Prismatic Debug Output Panel for errors or workflows.
2. **Webview not updating**: Ensure you're reloading the extension host.
3. **CLI not found**: Verify Prismatic CLI is installed globally.
4. **Authentication issues**: Check token storage and refresh logic

## Creating and Installing VSIX Packages

### Building a VSIX

```bash
# Package as VSIX
npm run package
```

This creates a `.vsix` file in the project root.

### Installing VSIX (Internal Testing)

#### VS Code
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X`)
3. Click the three-dot menu (⋮)
4. Select "Install from VSIX..."
5. Choose your `.vsix` file
6. Reload VS Code when prompted

#### Cursor
1. Open Cursor
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
3. Type "Extensions: Install from VSIX..."
4. Select your `.vsix` file
5. Restart Cursor if needed

## Release Process

### Automated Changelog Generation

The project uses GitHub CLI (`gh`) to automatically generate changelogs from git commits and tags.

#### Prerequisites
```bash
# Install GitHub CLI (if not already installed)
# macOS: brew install gh
# Windows: winget install GitHub.cli
# Linux: See https://cli.github.com/manual/installation

# Authenticate with GitHub
gh auth login
```

#### Release Workflow

1. **Finish your work and bump version on branch**:
   ```bash
   git checkout feature/your-feature-name
   ```

2. **Review and finalize**:
   ```bash
   # Build and test
   npm run build:prod
   npm run package
   ```

3. **Bump version on branch**:
   ```bash
   # Updates package.json and creates git tag
   npm version patch // or minor/major

   # Commit changes
   git add .
   git commit -m "chore: bump version to v0.0.24" // this is a example version, use the actual version

   # Push the feature branch and the new tag
   git push origin feature/your-feature-name --follow-tags
   ```

4. **Merge to main (includes the version bump)**

5. **Create release from the tag (which now points to main after merge)e**:
   ```bash
   gh release create v0.0.24 --generate-notes
   ```

### Internal Release Checklist

- [ ] All tests pass
- [ ] Code is formatted and linted (`npm run check:fix`)
- [ ] Version bumped in `package.json`
- [ ] VSIX package created and tested
- [ ] GitHub release created with notes
- [ ] Internal team notified

## Architecture Notes

### Key Components

- **AuthManager**: Handles Prismatic authentication and token management.
- **StateManager**: Wrapper around VSCode State that manages extension state persistence.
- **PrismCLIManager**: Interfaces with the Prismatic CLI to perform authentication and other CLI commands.
- **WebviewPanelManager**: Manages webview panel lifecycle and communication with the extension.
- **WebviewViewManager**: Manages webview view lifecycle and communication with the extension.
- **XState Machines**: Handle complex state logic for integrations and execution results.

### Webview Communication

Webviews communicate with the extension via:
- `vscode.postMessage()` for sending messages
- `window.addEventListener('message')` for receiving messages
- Message types defined in `src/types/messages.ts`

## Getting Help

- **Issues**: Create GitHub issues for bugs or feature requests
- **Code Review**: All changes require PR review
- **Documentation**: Update this file when adding new features
