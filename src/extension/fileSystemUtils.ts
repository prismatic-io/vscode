import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class FileSystemUtils {
  private static getWorkspaceRoot(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder is open");
    }
    return workspaceFolders[0].uri.fsPath;
  }

  static getPrismaticDir(): string {
    const workspaceRoot = this.getWorkspaceRoot();
    return path.join(workspaceRoot, ".prismatic");
  }

  static getExecutionsDir(): string {
    return path.join(this.getPrismaticDir(), "executions");
  }

  static getExecutionDir(executionId: string): string {
    return path.join(this.getExecutionsDir(), executionId);
  }

  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.access(dirPath);
    } catch (error) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  static async ensurePrismaticDirectoryExists(): Promise<void> {
    const prismaticDir = this.getPrismaticDir();
    const executionsDir = this.getExecutionsDir();
    
    await this.ensureDirectoryExists(prismaticDir);
    await this.ensureDirectoryExists(executionsDir);
  }

  static sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  static async writeJsonFile(filePath: string, data: any): Promise<void> {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, jsonContent, "utf8");
  }

  static async createExecutionDirectory(executionId: string): Promise<string> {
    await this.ensurePrismaticDirectoryExists();
    const executionDir = this.getExecutionDir(executionId);
    await this.ensureDirectoryExists(executionDir);
    return executionDir;
  }

  static getStepFileName(stepName: string): string {
    const sanitizedName = this.sanitizeFileName(stepName);
    return `step-${sanitizedName}.json`;
  }

  static async updateTypesFile(executionId: string, stepNames: string[]): Promise<void> {

    const typesFilePath = path.join(this.getPrismaticDir(), "types.ts");
    const executionDir = this.getExecutionDir(executionId);
    
    // Generate import statements for each step
    const imports: string[] = [];
    const stepResultTypes: string[] = [];
    
    for (const stepName of stepNames) {
      const sanitizedName = this.sanitizeFileName(stepName);
      const fileName = this.getStepFileName(stepName);
      const importName = `${sanitizedName.replace(/-/g, '')}Result`;
      const relativePath = `./executions/${executionId}/${fileName}`;
      
      imports.push(`import ${importName} from '${relativePath}';`);
      stepResultTypes.push(`  "${stepName}": typeof ${importName}.data;`);
    }

    // Generate the complete types.ts content
    const typesContent = `// Auto-generated type definitions for step results
// This file is maintained automatically by the VSCode extension

${imports.join('\n')}

/**
 * Execution metadata for the last test run
 */
export interface ExecutionMetadata {
  lastExecutionId: string | null;
  executedAt: string | null;
  totalSteps: number;
  stepNames: string[];
}

/**
 * Current execution metadata
 * Updated automatically after each test run
 */
export const executionMetadata: ExecutionMetadata = {
  lastExecutionId: "${executionId}",
  executedAt: "${new Date().toISOString()}",
  totalSteps: ${stepNames.length},
  stepNames: ${JSON.stringify(stepNames)}
};

/**
 * Step result type definitions
 * Types are extracted from actual JSON step result files using typeof
 */
export interface StepResultTypes {
${stepResultTypes.join('\n')}
}

/**
 * Utility types for working with step results
 */
export type StepName = keyof StepResultTypes;
export type StepResultForName<T extends StepName> = StepResultTypes[T];

/**
 * Module augmentation to enhance sendStepResult with type safety
 * This allows the sendStepResult function to use the specific step result types
 */
declare module "../src/sendStepResult" {
  interface StepResultData extends StepResultTypes {
    // Fallback to any for unknown step types to maintain backwards compatibility
    [key: string]: any;
  }
}
`;

    await this.writeTypesFile(typesFilePath, typesContent);
  }

  private static async writeTypesFile(filePath: string, content: string): Promise<void> {
    await fs.promises.writeFile(filePath, content, "utf8");
  }
}