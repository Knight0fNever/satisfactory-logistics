/**
 * v12 renames the factory view mode `'spreadsheet'` to `'detailed'`. The
 * old name implied a tabular grid; the actual UI is a vertical stack of
 * expanded factory cards, so the new name is more accurate.
 */
export function storeMigrationV12(state: unknown): unknown {
  const root = state as {
    factoryView?: { viewMode?: string };
  };
  if (root.factoryView?.viewMode === 'spreadsheet') {
    root.factoryView.viewMode = 'detailed';
  }
  return state;
}
