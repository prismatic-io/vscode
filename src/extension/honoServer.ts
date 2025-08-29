import * as vscode from "vscode";
import { Hono } from "hono";
import * as http from "node:http";
import * as crypto from "node:crypto";
import { log } from "@/extension";
import { tunnelService } from "@/extension/tunnelService";

let server: http.Server | undefined;
let serverPort: number | undefined;
let publicUrl: string | undefined;
let extensionContext: vscode.ExtensionContext;

const app = new Hono();

async function ensureGlobalToken(context: vscode.ExtensionContext): Promise<void> {
  let token = context.workspaceState.get<string>('prismatic.globalToken');
  
  if (!token) {
    // Generate a new secure token
    token = crypto.randomBytes(32).toString('hex');
    await context.workspaceState.update('prismatic.globalToken', token);
    log('INFO', 'Generated new global token for API authentication');
  }
}

// Set up routes
function setupRoutes() {
  // Root endpoint
  app.get("/", (c) => {
    return c.json({
      message: "Prismatic VSCode Extension Server",
      timestamp: new Date().toISOString(),
      version: "0.0.14",
    });
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", uptime: process.uptime() });
  });

  // Get workspace info
  app.get("/api/workspace", (c) => {
    return c.json({
      name: vscode.workspace.name || "No workspace",
      folders:
        vscode.workspace.workspaceFolders?.map((f) => ({
          name: f.name,
          path: f.uri.path,
        })) || [],
    });
  });

  // Execute VSCode command
  app.post("/api/command", async (c) => {
    try {
      const body = await c.req.json();
      const { command, args } = body;

      const result = await vscode.commands.executeCommand(
        command,
        ...((args as any[]) || []),
      );

      return c.json({ success: true, result });
    } catch (error) {
      console.error("Command execution error:", error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        400,
      );
    }
  });

  // Get active editor info
  app.get("/api/editor", (c) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return c.json({ error: "No active editor" }, 404);
    }

    return c.json({
      fileName: editor.document.fileName,
      language: editor.document.languageId,
      lineCount: editor.document.lineCount,
      selection: {
        start: {
          line: editor.selection.start.line,
          character: editor.selection.start.character,
        },
        end: {
          line: editor.selection.end.line,
          character: editor.selection.end.character,
        },
      },
    });
  });

  // Prismatic-specific endpoints
  app.get("/api/prismatic/status", (c) => {
    return c.json({
      extension: "Prismatic VSCode Extension",
      version: "0.0.14",
      serverRunning: true,
      activeSessions: 0, // activeTestSessions.size,
    });
  });

  // Step result collection endpoint
  app.post("/api/executions/:executionId/step-result", async (c) => {
    const executionId = c.req.param("executionId");

    try {
      const authHeader = c.req.header("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json(
          { error: "Missing or invalid Authorization header" },
          401,
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer '

      const expectedToken = getGlobalToken();
      if (token !== expectedToken) {
        return c.json({ error: "Invalid token" }, 403);
      }

      const body = await c.req.json();
      const { stepName, data } = body;

      if (!stepName) {
        return c.json({ error: "Missing stepName in request body" }, 400);
      }

      // Save step result directly to file system
      await saveStepResultToFileSystem(executionId, stepName, data);

      log(
        "INFO",
        `Saved step result: ${stepName} for execution ${executionId}`,
      );

      return c.json({
        success: true,
        message: `Step result '${stepName}' saved`,
        executionId,
        stepName,
      });
    } catch (error) {
      console.error("Step result save error:", error);
      return c.json(
        {
          error: "Failed to save step result",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  // Debug endpoint to test step result functionality
  app.post("/api/prismatic/test-step-result", async (c) => {
    try {
      const testExecutionId = "test-execution-123";
      const testStepName = "test-step";
      const testData = {
        message: "This is a test step result",
        timestamp: Date.now(),
      };

      // Save test step result directly to filesystem
      await saveStepResultToFileSystem(
        testExecutionId,
        testStepName,
        testData,
      );

      return c.json({
        success: true,
        message: "Test step result saved to filesystem",
        executionId: testExecutionId,
        stepName: testStepName,
      });
    } catch (error) {
      console.error("Test endpoint error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to save test step result",
        },
        500,
      );
    }
  });

  // Catch-all route
  app.all("*", (c) => {
    return c.json(
      {
        error: "Route not found",
        method: c.req.method,
        path: c.req.url,
      },
      404,
    );
  });
}

export async function startServer(context: vscode.ExtensionContext): Promise<void> {
  if (server) {
    return;
  }

  extensionContext = context;
  await ensureGlobalToken(context);
  setupRoutes();

  // Create HTTP server that uses Hono
  server = http.createServer(async (req, res) => {
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );

    let body: ArrayBuffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      body = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
    }

    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    });

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    try {
      const response = await app.fetch(request);
      
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      
      const responseBody = await response.text();
      res.end(responseBody);
    } catch (error) {
      console.error("Server error:", error);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Start server on auto-assigned port
  server.listen(0, "localhost", async () => {
    const address = server?.address();
    if (address && typeof address === "object") {
      serverPort = address.port;
      log("INFO", `Hono server started on port ${serverPort}`);

      // Set up port forwarding
      await setupPortForwarding(context, serverPort);
      log("SUCCESS", "Server setup completed with public tunnel");
    }
  });

  // Register cleanup
  context.subscriptions.push({
    dispose: async () => await stopServer(),
  });
}

async function setupPortForwarding(
  context: vscode.ExtensionContext,
  port: number,
): Promise<void> {
  try {
    log("INFO", `Creating public tunnel for port ${port}`);

    // Use the tunnel service to create a tunnel
    const tunnelUrl = await tunnelService.createTunnel(port, context);
    publicUrl = tunnelUrl;

    log(
      "INFO",
      `Server available at: ${publicUrl} (via ${tunnelService.getActiveProvider()})`,
    );

    // Show tunnel status
    await tunnelService.showTunnelStatus(context);
  } catch (error) {
    console.error("Tunnel setup error:", error);
    log("ERROR", `Failed to create tunnel: ${error}`);

    // Fallback to localhost
    const fallbackUrl = `http://localhost:${port}`;
    publicUrl = fallbackUrl;
    await context.workspaceState.update("honoServerUri", fallbackUrl);
    await context.workspaceState.update("honoServerPort", port);

    vscode.window
      .showWarningMessage(
        `Failed to create public tunnel. Server running on localhost only: ${fallbackUrl}`,
        "Copy Local URL",
      )
      .then((selection) => {
        if (selection === "Copy Local URL") {
          vscode.env.clipboard.writeText(fallbackUrl);
        }
      });
  }
}


export async function stopServer(): Promise<void> {
  if (server) {
    server.close();
    server = undefined;
    serverPort = undefined;
    log("INFO", "Hono server stopped");
  }

  // Disconnect tunnel
  try {
    await tunnelService.closeTunnel();
    publicUrl = undefined;
    log("INFO", "Tunnel disconnected");
  } catch (error) {
    console.error("Error disconnecting tunnel:", error);
  }
}


export function getPort(): number | undefined {
  return serverPort;
}

export function getPublicUrl(): string | null {
  if (!isServerRunning()) {
    return null;
  }

  const tunnelUrl = tunnelService.getPublicUrl();
  if (tunnelUrl && !tunnelUrl.includes("localhost")) {
    return tunnelUrl;
  }

  return `http://localhost:${serverPort}`;
}

export function isServerRunning(): boolean {
  return !!server && !!serverPort;
}

export function getGlobalToken(): string {
  const token = extensionContext?.workspaceState.get<string>('prismatic.globalToken');
  if (!token) {
    throw new Error('Global token not initialized. Make sure server is started first.');
  }
  return token;
}

async function saveStepResultToFileSystem(
  executionId: string,
  stepName: string,
  data: any,
): Promise<void> {
  try {
    // Import FileSystemUtils dynamically to avoid circular dependency
    const { FileSystemUtils } = await import("@/extension/fileSystemUtils");

    // Create execution directory
    const executionDir =
      await FileSystemUtils.createExecutionDirectory(executionId);

    // Create step result object
    const stepResult = {
      stepName,
      data,
      timestamp: new Date().toISOString(),
      receivedAt: Date.now(),
    };

    // Save step result as individual file
    const fileName = FileSystemUtils.getStepFileName(stepName);
    const filePath = `${executionDir}/${fileName}`;

    await FileSystemUtils.writeJsonFile(filePath, stepResult);
  } catch (error) {
    console.error(
      `Failed to save step result ${stepName} for execution ${executionId}:`,
      error,
    );
    throw error;
  }
}

// Export the saveStepResultToFileSystem function for external use
export { saveStepResultToFileSystem };
