# Change Log

[Click here for the latest release notes](https://github.com/prismatic-io/vscode/releases/latest)

## Unreleased

- Added large-data-sync support to the Execution Results view: batched executions now expand to show per-batch status, with a status bar progress indicator, batched-aware tooltips, a cancel command, and pagination for long batch lists.
- Added a Batch Progress webview panel (Open Batch Summary command / batched-parent inline action) with a segmented progress bar, batch tile grid, and refresh/load-more/cancel actions. The panel subscribes to the shared batch service and diffs frames before posting to keep re-renders cheap.
