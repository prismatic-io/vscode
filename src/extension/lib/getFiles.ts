import * as path from "node:path";
import * as vscode from "vscode";

export interface GetFilesFileInfo {
  fileName: string;
  filePath: vscode.Uri;
  relativePath: string;
  extension: string;
  size: number;
  modified: Date;
  isDirectory: boolean;
}

export interface GetFilesOptions {
  extensions?: string[];
  globPattern?: string;
}

/**
 * Get files from specified directories using VS Code's native APIs
 * @param directories - Array of directory URIs to search
 * @param options - Configuration options
 * @returns Promise<Array of file information objects>
 */
export const getFilesInDirectories = async (
  directories: vscode.Uri[],
  options: GetFilesOptions = {},
): Promise<GetFilesFileInfo[]> => {
  const { extensions = [], globPattern } = options;

  const files: GetFilesFileInfo[] = [];

  for (const directory of directories) {
    try {
      const directoryFiles = await getFilesInDirectory(directory, {
        extensions,
        globPattern,
      });

      files.push(...directoryFiles);
    } catch (error) {
      console.warn(`Failed to read directory ${directory.fsPath}:`, error);
    }
  }

  return files;
};

/**
 * Get files from a directory using VS Code APIs
 * @param directory - Directory URI to search
 * @param options - Configuration options
 * @returns Promise<Array of file information objects>
 */
export const getFilesInDirectory = async (
  directory: vscode.Uri,
  options: GetFilesOptions,
): Promise<GetFilesFileInfo[]> => {
  const { extensions = [], globPattern } = options;

  const files: GetFilesFileInfo[] = [];

  try {
    if (globPattern) {
      const pattern = path.join(directory.fsPath, globPattern);
      const foundFiles = await vscode.workspace.findFiles(pattern, null, 1000);

      for (const file of foundFiles) {
        const relativePath = path.relative(directory.fsPath, file.fsPath);
        const fileName = path.basename(file.fsPath);
        const fileExtension = path.extname(fileName);
        const stats = await vscode.workspace.fs.stat(file);

        const fileInfo: GetFilesFileInfo = {
          fileName,
          filePath: file,
          relativePath,
          extension: fileExtension,
          size: stats.size,
          modified: new Date(stats.mtime),
          isDirectory: (stats.type & vscode.FileType.Directory) !== 0,
        };

        if (extensions) {
          if (extensions.includes(fileInfo.extension)) {
            files.push(fileInfo);
          }
        } else {
          files.push(fileInfo);
        }
      }
    } else {
      const foundFiles = await vscode.workspace.fs.readDirectory(directory);

      for (const [name, type] of foundFiles) {
        const fileUri = vscode.Uri.joinPath(directory, name);
        const relativePath = path.relative(directory.fsPath, fileUri.fsPath);
        const fileExtension = path.extname(name);

        const stats = await vscode.workspace.fs.stat(fileUri);

        const fileInfo: GetFilesFileInfo = {
          fileName: name,
          filePath: fileUri,
          relativePath,
          extension: fileExtension,
          size: stats.size,
          modified: new Date(stats.mtime),
          isDirectory: (type & vscode.FileType.Directory) !== 0,
        };

        if (extensions) {
          if (extensions.includes(fileInfo.extension)) {
            files.push(fileInfo);
          }
        } else {
          files.push(fileInfo);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${directory.fsPath}:`, error);
  }

  return files;
};

/**
 * Function to get files with specific extensions using VS Code APIs
 * @param directories - Array of directory URIs
 * @param extensions - Array of file extensions to match
 * @returns Promise<Array of file information objects>[]
 */
export const getFilesByExtension = async (
  directories: vscode.Uri[],
  extensions: string[],
): Promise<GetFilesFileInfo[]> => {
  return getFilesInDirectories(directories, {
    extensions,
  });
};

/**
 * Function to get JSON files using VS Code APIs
 * @param directories - Array of directory URIs
 * @returns Promise<Array of file information objects>[]
 */
export const getJsonFiles = async (
  directories: vscode.Uri[],
): Promise<GetFilesFileInfo[]> => {
  return getFilesByExtension(directories, [".json"]);
};

/**
 * Function to get TypeScript files using VS Code APIs
 * @param directories - Array of directory URIs
 * @returns Promise<Array of file information objects>[]
 */
export const getTypeScriptFiles = async (
  directories: vscode.Uri[],
): Promise<GetFilesFileInfo[]> => {
  return getFilesByExtension(directories, [".ts", ".tsx"]);
};

/**
 * Function to get JavaScript files using VS Code APIs
 * @param directories - Array of directory URIs
 * @returns Promise<Array of file information objects>[]
 */
export const getJavaScriptFiles = async (
  directories: vscode.Uri[],
): Promise<GetFilesFileInfo[]> => {
  return getFilesByExtension(directories, [".js", ".jsx"]);
};

/**
 * Find files using VS Code's native glob pattern matching
 * @param pattern - Glob pattern for file matching
 * @param exclude - Exclude pattern (optional)
 * @param maxResults - Maximum number of results (default: 1000)
 * @returns Promise<Array of file URIs>[]
 */
export const findFilesWithGlob = async (
  pattern: string,
  exclude?: string,
  maxResults = 1000,
): Promise<vscode.Uri[]> => {
  return vscode.workspace.findFiles(pattern, exclude, maxResults);
};

/**
 * Get workspace folder URIs
 * @returns Array of workspace folder URIs[]
 */
export const getWorkspaceFolders = (): vscode.Uri[] => {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders) {
    return [];
  }

  return folders.map((folder) => folder.uri);
};

/**
 * Convert string paths to VS Code URIs
 * @param paths - Array of string paths
 * @returns Array of VS Code URIs[]
 */
export const pathsToUris = (paths: string[]): vscode.Uri[] => {
  return paths.map((path) => vscode.Uri.file(path));
};

/**
 * Convert VS Code URIs to string paths
 * @param uris - Array of VS Code URIs
 * @returns Array of string paths[]
 */
export const urisToPaths = (uris: vscode.Uri[]): string[] => {
  return uris.map((uri) => uri.fsPath);
};

/**
 * Function to get directories with a specific pattern using VS Code APIs
 * @param pattern - Pattern to match
 * @param maxResults - Maximum number of results (default: 1000)
 * @param exclude - Exclude pattern (optional)
 * @returns Promise<Array of directory URIs>[]
 */
export const getDirectoriesWithPattern = async (
  pattern: string,
  maxResults = 1000,
  exclude?: string,
): Promise<vscode.Uri[]> => {
  const allMatches = await findFilesWithGlob(pattern, exclude, maxResults);

  const uniqueProjectPaths = new Set<string>();

  for (const fileUri of allMatches) {
    const targetDirName = pattern.includes("**/")
      ? pattern.split("**/")[1].split("/")[0]
      : pattern.split("/").pop()?.replace("**", "") || "";

    if (targetDirName && fileUri.fsPath.includes(`/${targetDirName}/`)) {
      const targetDirPath = `${fileUri.fsPath.split(`/${targetDirName}/`)[0]}/${targetDirName}`;
      const projectPath = path.dirname(targetDirPath);

      uniqueProjectPaths.add(projectPath);
    }
  }

  return Array.from(uniqueProjectPaths).map((projectPath) =>
    vscode.Uri.file(projectPath),
  );
};

/**
 * Get Spectral projects by searching for directories with the ".spectral" pattern
 * @returns Promise<Array of project information objects>
 */
export const getProjectsBySpectralDirectory = async (): Promise<
  { uri: vscode.Uri; fsPath: string; fileName: string }[]
> => {
  return (await getDirectoriesWithPattern("**/.spectral/**")).map((uri) => ({
    uri,
    fsPath: uri.fsPath,
    fileName: path.basename(uri.fsPath),
  }));
};

/**
 * Generic function to find projects by searching for files with specific export patterns
 * @param filePattern - Glob pattern for files to search
 * @param exportPatterns - Array of patterns to match in file content
 * @param nameExtractionRegex - Regex to extract project name from file content
 * @param maxResults - Maximum number of files to search
 * @returns Promise<Array of project information objects>
 */
export const getProjectsByExport = async (
  filePattern: string,
  exportPatterns: string[],
  nameExtractionRegex: RegExp,
  maxResults = 1000,
): Promise<
  {
    uri: vscode.Uri;
    fsPath: string;
    fileName: string;
    projectName: string;
    projectPath: string;
  }[]
> => {
  // Search for files matching the pattern
  const files = await findFilesWithGlob(filePattern, undefined, maxResults);

  const projects: {
    uri: vscode.Uri;
    fsPath: string;
    fileName: string;
    projectName: string;
    projectPath: string;
  }[] = [];

  for (const fileUri of files) {
    try {
      // Read the file content
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(fileContent).toString("utf-8");

      // Check if the file contains any of the export patterns
      const hasMatchingExport = exportPatterns.some((pattern) =>
        content.includes(pattern),
      );

      if (hasMatchingExport) {
        // Extract project name using the provided regex
        const nameMatch = content.match(nameExtractionRegex);
        const projectName = nameMatch
          ? nameMatch[1]
          : path.basename(path.dirname(fileUri.fsPath));

        // Find the project root directory (look for package.json or go up directories)
        let projectPath = path.dirname(fileUri.fsPath);
        let currentPath = projectPath;

        // Walk up the directory tree to find the project root
        while (currentPath !== path.dirname(currentPath)) {
          try {
            const packageJsonPath = path.join(currentPath, "package.json");
            const packageJsonUri = vscode.Uri.file(packageJsonPath);
            await vscode.workspace.fs.stat(packageJsonUri);
            projectPath = currentPath;
            break;
          } catch {
            // package.json not found, go up one level
            currentPath = path.dirname(currentPath);
          }
        }

        projects.push({
          uri: fileUri,
          fsPath: fileUri.fsPath,
          fileName: path.basename(fileUri.fsPath),
          projectName,
          projectPath,
        });
      }
    } catch (error) {
      // Skip files that can't be read
      console.warn(`Could not read file ${fileUri.fsPath}:`, error);
    }
  }

  return projects;
};

/**
 * Find CNI projects by searching for files with "default export integration"
 * @returns Promise<Array of project information objects>
 */
export const getCNIProjectsByExport = async (): Promise<
  {
    uri: vscode.Uri;
    fsPath: string;
    fileName: string;
    projectName: string;
    projectPath: string;
  }[]
> => {
  return getProjectsByExport(
    "**/*.{ts,js}",
    ["default export integration", "export default integration"],
    /name:\s*["']([^"']+)["']/,
    1000,
  );
};

/**
 * Find component projects by searching for files with "export default component"
 * @returns Promise<Array of project information objects>
 */
export const getComponentProjectsByExport = async (): Promise<
  {
    uri: vscode.Uri;
    fsPath: string;
    fileName: string;
    projectName: string;
    projectPath: string;
  }[]
> => {
  return getProjectsByExport(
    "**/*.{ts,js}",
    ["export default component"],
    /label:\s*["']([^"']+)["']/,
    1000,
  );
};
