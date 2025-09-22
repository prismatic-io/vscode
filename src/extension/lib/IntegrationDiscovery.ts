import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { StateManager } from "@/extension/StateManager";
import { log } from "@/extension";

/**
 * Information about a discovered .spectral folder in the workspace
 */
export interface SpectralFolderInfo {
  /** Absolute path to folder containing .spectral */
  path: string;
  /** Absolute path to .spectral directory */
  spectralPath: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** Friendly name (folder name) */
  name: string;
  /** .spectral directory exists */
  hasSpectralDir: boolean;
  /** .spectral/prism.json exists */
  hasPrismJson: boolean;
  /** Integration ID from prism.json (if exists) */
  integrationId?: string;
  /** Depth from workspace root (for prioritization) */
  depth: number;
}

/**
 * Service for discovering and managing multiple integrations in a workspace
 */
export class IntegrationDiscovery {
  private static cache: Map<string, SpectralFolderInfo[]> = new Map();
  private static cacheTimeout: NodeJS.Timeout | null = null;
  private static readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Find all integrations (.spectral directories) in the workspace
   * Results are cached for 30 seconds to avoid repeated file system scans
   */
  static async findAllIntegrations(): Promise<SpectralFolderInfo[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      log("WARN", "[IntegrationDiscovery] No workspace folder found");
      return [];
    }

    const cacheKey = workspaceFolder.uri.fsPath;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      log("INFO", `[IntegrationDiscovery] Returning ${cached.length} cached integrations`);
      return cached;
    }

    log("INFO", "[IntegrationDiscovery] Scanning for .spectral directories...");

    // Find all .spectral directories
    // findFiles only returns files, not directories, so we search for files within .spectral dirs
    const pattern = new vscode.RelativePattern(workspaceFolder, "**/.spectral/*");
    const excludePattern = "**/node_modules/**";

    const fileUris = await vscode.workspace.findFiles(pattern, excludePattern);
    log("INFO", `[IntegrationDiscovery] Found ${fileUris.length} files within .spectral directories`);

    // Extract unique .spectral directory paths from the file results
    const spectralPaths = new Set<string>();
    for (const uri of fileUris) {
      const filePath = uri.fsPath;
      // Find the .spectral directory in the path
      const spectralIndex = filePath.lastIndexOf(path.sep + ".spectral");
      if (spectralIndex !== -1) {
        const spectralPath = filePath.substring(0, spectralIndex + ".spectral".length + 1);
        spectralPaths.add(spectralPath);
      }
    }

    log("INFO", `[IntegrationDiscovery] Found ${spectralPaths.size} .spectral directories`);

    const integrations: SpectralFolderInfo[] = [];

    for (const spectralPath of spectralPaths) {
      const integrationPath = path.dirname(spectralPath);
      const relativePath = vscode.workspace.asRelativePath(integrationPath);
      const name = path.basename(integrationPath);

      // Check for prism.json
      const prismJsonPath = path.join(spectralPath, "prism.json");
      let hasPrismJson = false;
      let integrationId: string | undefined;

      try {
        if (fs.existsSync(prismJsonPath)) {
          hasPrismJson = true;
          const prismContent = JSON.parse(fs.readFileSync(prismJsonPath, "utf8"));
          integrationId = prismContent.integrationId;
          log(
            "INFO",
            `[IntegrationDiscovery] Found prism.json in ${name} with ID: ${integrationId}`
          );
        }
      } catch (error) {
        log(
          "WARN",
          `[IntegrationDiscovery] Error reading prism.json in ${name}: ${error}`
        );
      }

      integrations.push({
        path: integrationPath,
        spectralPath,
        relativePath,
        name,
        hasSpectralDir: true,
        hasPrismJson,
        integrationId,
        depth: relativePath.split(path.sep).length,
      });
    }

    // Sort by import status (imported first) then by depth (shallower first)
    integrations.sort((a, b) => {
      // Imported integrations come first
      if (a.hasPrismJson !== b.hasPrismJson) {
        return a.hasPrismJson ? -1 : 1;
      }
      // Then sort by depth (shallower first)
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      // Finally sort by name for consistency
      return a.name.localeCompare(b.name);
    });

    log(
      "INFO",
      `[IntegrationDiscovery] Discovered ${integrations.length} integrations: ${integrations
        .map((i) => `${i.name}${i.hasPrismJson ? " (imported)" : ""}`)
        .join(", ")}`
    );

    // Cache results
    this.cache.set(cacheKey, integrations);
    this.scheduleCacheClear();

    return integrations;
  }

  /**
   * Get the currently active integration based on state and discovery
   */
  static async getActiveIntegration(): Promise<SpectralFolderInfo | undefined> {
    const integrations = await this.findAllIntegrations();

    if (integrations.length === 0) {
      log("INFO", "[IntegrationDiscovery] No integrations found in workspace");
      return undefined;
    }

    const stateManager = StateManager.getInstance();
    const state = await stateManager.getWorkspaceState();

    // Try to find by active integration path
    if (state?.activeIntegrationPath) {
      const active = integrations.find((i) => i.path === state.activeIntegrationPath);
      if (active) {
        log(
          "INFO",
          `[IntegrationDiscovery] Active integration from state path: ${active.name}`
        );
        return active;
      }
    }

    // Try to find by integration ID
    if (state?.integrationId) {
      const active = integrations.find((i) => i.integrationId === state.integrationId);
      if (active) {
        log(
          "INFO",
          `[IntegrationDiscovery] Active integration from state ID: ${active.name}`
        );
        return active;
      }
    }

    // Default to first imported integration
    const firstImported = integrations.find((i) => i.hasPrismJson);
    if (firstImported) {
      log(
        "INFO",
        `[IntegrationDiscovery] Defaulting to first imported integration: ${firstImported.name}`
      );
      return firstImported;
    }

    // Fall back to first integration
    log(
      "INFO",
      `[IntegrationDiscovery] Defaulting to first integration: ${integrations[0].name}`
    );
    return integrations[0];
  }

  /**
   * Get integration that contains the given file path
   */
  static async getIntegrationForFile(
    filePath: string
  ): Promise<SpectralFolderInfo | undefined> {
    const integrations = await this.findAllIntegrations();

    // Find the integration that contains this file
    // Check from deepest to shallowest to find the most specific match
    const sortedByDepth = [...integrations].sort((a, b) => b.depth - a.depth);

    for (const integration of sortedByDepth) {
      if (filePath.startsWith(integration.path)) {
        log(
          "INFO",
          `[IntegrationDiscovery] File ${filePath} belongs to integration: ${integration.name}`
        );
        return integration;
      }
    }

    return undefined;
  }

  /**
   * Clear the cache, forcing a fresh scan on next call
   */
  static clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();

    if (this.cacheTimeout) {
      clearTimeout(this.cacheTimeout);
      this.cacheTimeout = null;
    }

    if (size > 0) {
      log("INFO", "[IntegrationDiscovery] Cache cleared");
    }
  }

  /**
   * Schedule cache to be cleared after CACHE_DURATION
   */
  private static scheduleCacheClear(): void {
    if (this.cacheTimeout) {
      clearTimeout(this.cacheTimeout);
    }

    this.cacheTimeout = setTimeout(() => {
      this.clearCache();
    }, this.CACHE_DURATION);
  }

  /**
   * Check if the workspace has multiple integrations
   */
  static async hasMultipleIntegrations(): Promise<boolean> {
    const integrations = await this.findAllIntegrations();
    return integrations.length > 1;
  }

  /**
   * Check if the workspace has any integrations
   */
  static async hasAnyIntegrations(): Promise<boolean> {
    const integrations = await this.findAllIntegrations();
    return integrations.length > 0;
  }

  /**
   * Get integration by ID
   */
  static async getIntegrationById(
    integrationId: string
  ): Promise<SpectralFolderInfo | undefined> {
    const integrations = await this.findAllIntegrations();
    return integrations.find((i) => i.integrationId === integrationId);
  }

  /**
   * Get integration by path
   */
  static async getIntegrationByPath(
    integrationPath: string
  ): Promise<SpectralFolderInfo | undefined> {
    const integrations = await this.findAllIntegrations();
    return integrations.find((i) => i.path === integrationPath);
  }
}