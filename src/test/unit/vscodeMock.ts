/**
 * Canonical `vscode` module mock for unit tests.
 *
 * Applied globally via `src/test/unit/setup.ts`, so individual test files
 * should NOT call `vi.mock("vscode")`. Per-test behavior is added via
 * `vi.spyOn(vscode.x, "y").mockReturnValue(...)` against this baseline.
 *
 * Covers: TreeItem, ThemeIcon, ThemeColor, EventEmitter, MarkdownString, Uri,
 * TreeItemCollapsibleState, ProgressLocation, ExtensionMode, ViewColumn, and
 * stub `window`, `workspace`, `commands`, `languages`, `env`, and `extensions`
 * namespaces. Extend this module (not individual tests) when a new API
 * becomes broadly useful.
 */

export class TreeItem {
  label: string | { label: string };
  collapsibleState: number;
  description?: string | boolean;
  tooltip?: unknown;
  contextValue?: string;
  iconPath?: unknown;
  command?: unknown;
  id?: string;
  resourceUri?: unknown;
  constructor(label: string | { label: string }, collapsibleState: number = 0) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
} as const;

export class ThemeIcon {
  static readonly File = new ThemeIcon("file");
  static readonly Folder = new ThemeIcon("folder");
  constructor(
    public id: string,
    public color?: unknown,
  ) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class EventEmitter<T = unknown> {
  private handlers: Array<(value: T) => void> = [];
  readonly event = (handler: (value: T) => void) => {
    this.handlers.push(handler);
    return {
      dispose: () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      },
    };
  };
  fire(value?: T) {
    for (const h of this.handlers) h(value as T);
  }
  dispose() {
    this.handlers = [];
  }
}

export class MarkdownString {
  value = "";
  isTrusted?: boolean;
  appendMarkdown(text: string): this {
    this.value += text;
    return this;
  }
  appendText(text: string): this {
    this.value += text;
    return this;
  }
  appendCodeblock(code: string, language?: string): this {
    this.value += `\n\`\`\`${language ?? ""}\n${code}\n\`\`\`\n`;
    return this;
  }
}

export class Uri {
  constructor(
    public scheme: string,
    public path: string,
  ) {}
  get fsPath(): string {
    return this.path;
  }
  static parse(value: string): Uri {
    const colonIdx = value.indexOf(":");
    if (colonIdx < 0) return new Uri("", value);
    return new Uri(value.slice(0, colonIdx), value.slice(colonIdx + 1));
  }
  static file(fsPath: string): Uri {
    return new Uri("file", fsPath);
  }
  static joinPath(base: Uri, ...segments: string[]): Uri {
    const joined = [base.path, ...segments]
      .map((s) => s.replace(/\/+$/, ""))
      .filter(Boolean)
      .join("/");
    return new Uri(base.scheme, joined);
  }
  toString(): string {
    return `${this.scheme}:${this.path}`;
  }
  with(change: { scheme?: string; path?: string }): Uri {
    return new Uri(change.scheme ?? this.scheme, change.path ?? this.path);
  }
}

export const ProgressLocation = {
  SourceControl: 1,
  Window: 10,
  Notification: 15,
} as const;

export const ExtensionMode = {
  Production: 1,
  Development: 2,
  Test: 3,
} as const;

export const ViewColumn = {
  Active: -1,
  Beside: -2,
  One: 1,
  Two: 2,
  Three: 3,
} as const;

const noop = () => {};
const noopReturningDispose = () => ({ dispose: noop });

/**
 * Build a fresh canonical vscode mock. Each call returns new class references
 * and namespace stubs so tests cannot accidentally share mutable state.
 */
export const createVscodeMock = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  TreeItem,
  TreeItemCollapsibleState,
  ThemeIcon,
  ThemeColor,
  EventEmitter,
  MarkdownString,
  Uri,
  ProgressLocation,
  ExtensionMode,
  ViewColumn,
  commands: {
    registerCommand: noopReturningDispose,
    executeCommand: noop,
    getCommands: async () => [],
  },
  window: {
    createOutputChannel: () => ({
      appendLine: noop,
      append: noop,
      show: noop,
      clear: noop,
      dispose: noop,
    }),
    createTreeView: () => ({
      visible: true,
      onDidChangeVisibility: () => ({ dispose: noop }),
      reveal: async () => {},
      dispose: noop,
    }),
    showInformationMessage: noop,
    showWarningMessage: noop,
    showErrorMessage: noop,
    withProgress: async (_: unknown, task: (p: unknown) => unknown) =>
      task({ report: noop }),
  },
  workspace: {
    workspaceFolders: undefined,
    onDidChangeWorkspaceFolders: () => ({ dispose: noop }),
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose: noop }),
      onDidChange: () => ({ dispose: noop }),
      onDidDelete: () => ({ dispose: noop }),
      dispose: noop,
    }),
    registerTextDocumentContentProvider: noopReturningDispose,
    openTextDocument: async () => ({ getText: () => "" }),
    getConfiguration: () => ({
      get: (_section: string, defaultValue?: unknown) => defaultValue,
      has: () => false,
      inspect: () => undefined,
      update: async () => undefined,
    }),
  },
  languages: {
    setTextDocumentLanguage: async () => {},
    getLanguages: async () => [],
  },
  env: {
    openExternal: async () => true,
  },
  extensions: {
    getExtension: () => undefined,
  },
  ...overrides,
});
