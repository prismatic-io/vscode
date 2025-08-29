// extension.ts - Main extension file
import * as vscode from 'vscode';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { Server } from 'node:http';

let server: Server | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated');

    // Initialize the Hono server
    const app = new Hono();

    // ============================================
    // BASIC HONO SERVER SETUP
    // ============================================

    // Root endpoint
    app.get('/', (c) => {
        return c.json({
            message: 'VSCode Extension Server',
            timestamp: new Date().toISOString()
        });
    });

    // Get workspace info
    app.get('/api/workspace', (c) => {
        return c.json({
            name: vscode.workspace.name || 'No workspace',
            folders: vscode.workspace.workspaceFolders?.map(f => f.uri.path) || []
        });
    });

    // Execute VSCode command
    app.post('/api/command', async (c) => {
        try {
            const { command, args } = await c.req.json();
            const result = await vscode.commands.executeCommand(command, args);
            return c.json({ success: true, result });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }, 400);
        }
    });

    // Get active editor info
    app.get('/api/editor', (c) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return c.json({ error: 'No active editor' }, 404);
        }

        return c.json({
            fileName: editor.document.fileName,
            language: editor.document.languageId,
            lineCount: editor.document.lineCount,
            selection: {
                start: editor.selection.start,
                end: editor.selection.end
            }
        });
    });

    // ============================================
    // START SERVER WITH PORT FORWARDING
    // ============================================

    // Start server on random available port (0 = auto-assign)
    server = serve({
        fetch: app.fetch,
        port: 0,
    }, async (info) => {
        const port = info.port;
        console.log(`Hono server started on port ${port}`);

        // ============================================
        // PROGRAMMATIC PORT FORWARDING
        // ============================================

        // Method 1: Use vscode.env.asExternalUri to forward the port
        const localUri = vscode.Uri.parse(`http://localhost:${port}`);
        const externalUri = await vscode.env.asExternalUri(localUri);

        console.log(`Port forwarded to: ${externalUri.toString()}`);

        // Show information message with clickable link
        const selection = await vscode.window.showInformationMessage(
            `Extension server running on port ${port}`,
            'Open in Browser',
            'Copy URL'
        );

        if (selection === 'Open in Browser') {
            vscode.env.openExternal(externalUri);
        } else if (selection === 'Copy URL') {
            vscode.env.clipboard.writeText(externalUri.toString());
            vscode.window.showInformationMessage('URL copied to clipboard!');
        }

        // Store port in workspace state if needed
        context.workspaceState.update('serverPort', port);
    });

    // ============================================
    // REGISTER COMMANDS
    // ============================================

    // Command to get server info
    const getServerInfo = vscode.commands.registerCommand('extension.getServerInfo', async () => {
        const port = context.workspaceState.get<number>('serverPort');
        if (port) {
            const uri = vscode.Uri.parse(`http://localhost:${port}`);
            const externalUri = await vscode.env.asExternalUri(uri);
            vscode.window.showInformationMessage(`Server running at: ${externalUri.toString()}`);
        } else {
            vscode.window.showWarningMessage('Server not running');
        }
    });

    // Command to restart server
    const restartServer = vscode.commands.registerCommand('extension.restartServer', () => {
        deactivate();
        activate(context);
        vscode.window.showInformationMessage('Server restarted');
    });

    context.subscriptions.push(getServerInfo, restartServer);

    // ============================================
    // CLEANUP ON DEACTIVATION
    // ============================================

    context.subscriptions.push({
        dispose: () => {
            if (server) {
                server.close();
                console.log('Server stopped');
            }
        }
    });
}

export function deactivate() {
    if (server) {
        server.close();
        server = undefined;
        console.log('Extension deactivated, server stopped');
    }
}

// ============================================
// package.json - Dependencies and configuration
// ============================================
/*
{
  "name": "vscode-hono-extension",
  "displayName": "Hono Server Extension",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.74.0"
  },
  "main": "./out/extension.js",
  "activationEvents": [
    "onStartupFinished"
  ],
  "contributes": {
    "commands": [
      {
        "command": "extension.getServerInfo",
        "title": "Get Server Info"
      },
      {
        "command": "extension.restartServer",
        "title": "Restart Extension Server"
      }
    ],
    "configuration": {
      "title": "Hono Server",
      "properties": {
        "honoServer.autoStart": {
          "type": "boolean",
          "default": true,
          "description": "Automatically start server on extension activation"
        },
        "honoServer.port": {
          "type": "number",
          "default": 0,
          "description": "Server port (0 for auto-assign)"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "^20.x",
    "typescript": "^5.3.0"
  }
}
*/

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Test endpoints with curl or browser:

// Get workspace info
curl http://localhost:PORT/api/workspace

// Execute a command
curl -X POST http://localhost:PORT/api/command \
  -H "Content-Type: application/json" \
  -d '{"command":"workbench.action.toggleSidebarVisibility"}'

// Get active editor info
curl http://localhost:PORT/api/editor
*/

// ============================================
// PORT FORWARDING NOTES
// ============================================

/*
Port Forwarding Behavior:
- Local Development: asExternalUri returns the same localhost URL
- Remote SSH/Containers: Creates a tunnel and returns the forwarded URL
- Codespaces: Returns the Codespace forwarding URL
- The API handles all forwarding complexity automatically

Alternative Port Configuration in package.json:
"portsAttributes": {
  "3000": {
    "label": "Hono Server",
    "onAutoForward": "notify",
    "requireLocalPort": false
  }
}

onAutoForward options:
- "notify": Show notification when port is forwarded
- "openBrowser": Open browser automatically
- "openPreview": Open preview panel in VSCode
- "silent": Forward without notification
- "ignore": Don't forward
*/
