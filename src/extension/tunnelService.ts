import * as vscode from "vscode";
import { log } from "@/extension";

// Tunnel provider interface
export interface TunnelProvider {
  name: string;
  connect(port: number): Promise<string>;
  disconnect(): Promise<void>;
  isAvailable(): Promise<boolean>;
}

// NgrokProvider implementation
class NgrokProvider implements TunnelProvider {
  name = "ngrok";
  private ngrok: any;

  constructor() {
    try {
      this.ngrok = require("ngrok");
    } catch (error) {
      console.error("Failed to load ngrok module:", error);
      this.ngrok = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.ngrok) {
      return false;
    }

    try {
      const { spawn } = require('child_process');
      const checkProcess = spawn('ngrok', ['--version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        checkProcess.on('close', (code: number | null) => {
          const available = code === 0;
          resolve(available);
        });
        
        checkProcess.on('error', (err: Error) => {
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  async connect(port: number): Promise<string> {
    if (!this.ngrok) {
      throw new Error("ngrok module not available");
    }

    console.log(`🚀 Starting ngrok tunnel for port ${port}...`);
    
    // Simple connection with timeout
    const tunnelPromise = this.ngrok.connect(port);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('ngrok connection timed out after 30 seconds')), 30000);
    });

    const url = await Promise.race([tunnelPromise, timeoutPromise]);
    console.log(`🌐 ngrok tunnel created: ${url}`);
    return url;
  }

  async disconnect(): Promise<void> {
    if (this.ngrok) {
      try {
        await this.ngrok.kill();
      } catch (error) {
        console.error("Error disconnecting ngrok:", error);
      }
    }
  }
}

// LocaltunnelProvider implementation
class LocaltunnelProvider implements TunnelProvider {
  name = "localtunnel";
  private localtunnel: any;
  private tunnel: any = null;

  constructor() {
    try {
      this.localtunnel = require("localtunnel");
    } catch (error) {
      console.error("Failed to load localtunnel module:", error);
      this.localtunnel = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    const available = !!this.localtunnel;
    return available;
  }

  async connect(port: number): Promise<string> {
    if (!this.localtunnel) {
      throw new Error("localtunnel module not available");
    }

    const tunnelPromise = this.localtunnel({ port });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('localtunnel connection timed out after 15 seconds')), 15000);
    });

    this.tunnel = await Promise.race([tunnelPromise, timeoutPromise]);
    const url = this.tunnel.url;
    
    // Handle tunnel events
    this.tunnel.on('close', () => {
      // Tunnel closed
    });

    this.tunnel.on('error', (err: Error) => {
      console.error('localtunnel error:', err);
    });

    return url;
  }

  async disconnect(): Promise<void> {
    if (this.tunnel) {
      try {
        this.tunnel.close();
        this.tunnel = null;
      } catch (error) {
        console.error("Error disconnecting localtunnel:", error);
      }
    }
  }
}

// TunnelService - manages tunnel providers
export class TunnelService {
  private providers: TunnelProvider[] = [];
  private activeProvider: TunnelProvider | null = null;
  private publicUrl: string | null = null;

  constructor() {
    // Register available providers - localtunnel first since it requires no auth
    this.providers = [
      new LocaltunnelProvider(),
      new NgrokProvider()
    ];
  }

  async createTunnel(port: number, context: vscode.ExtensionContext): Promise<string> {
    // Try each provider until one works
    for (const provider of this.providers) {
      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          continue;
        }

        const url = await provider.connect(port);
        
        this.activeProvider = provider;
        this.publicUrl = url;
        
        log("SUCCESS", `Tunnel created with ${provider.name}: ${url}`);
        
        // Store in workspace state
        await context.workspaceState.update('honoServerUri', url);
        await context.workspaceState.update('honoServerPort', port);
        await context.workspaceState.update('tunnelProvider', provider.name);
        
        return url;
        
      } catch (error) {
        console.error(`${provider.name} failed:`, error);
        log("ERROR", `${provider.name} tunnel failed: ${error}`);
        continue;
      }
    }

    // All providers failed
    const fallbackUrl = `http://localhost:${port}`;
    log("WARN", "All tunnel providers failed, using localhost");
    
    await context.workspaceState.update('honoServerUri', fallbackUrl);
    await context.workspaceState.update('honoServerPort', port);
    await context.workspaceState.update('tunnelProvider', 'localhost');
    
    return fallbackUrl;
  }

  async closeTunnel(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.disconnect();
      this.activeProvider = null;
      this.publicUrl = null;
    }
  }

  getPublicUrl(): string | null {
    return this.publicUrl;
  }

  getActiveProvider(): string | null {
    return this.activeProvider?.name || null;
  }

  async showTunnelStatus(context: vscode.ExtensionContext): Promise<void> {
    const provider = this.getActiveProvider();
    const url = this.getPublicUrl();
    
    if (provider && url) {
      const message = `Tunnel active: ${provider} - ${url}`;
      const selection = await vscode.window.showInformationMessage(
        message,
        'Copy URL',
        'Open in Browser'
      );

      if (selection === 'Copy URL') {
        vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage('Tunnel URL copied!');
      } else if (selection === 'Open in Browser') {
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    } else {
      vscode.window.showWarningMessage('No active tunnel. Server running on localhost only.');
    }
  }
}

// Export singleton instance
export const tunnelService = new TunnelService();