// Utility to humanise file and directory names for display in the tree
// Examples: "01_getting_started.md" => "Getting started", "README.md" => "README"
export function humanizeFileName(raw: string): string {
  if (!raw) return '';
  let name = raw;
  // Remove leading digits with separators
  name = name.replace(/^\d+[\-_ ]+/, '');
  // Strip common markdown/text extensions
  name = name.replace(/\.(md|markdown|txt)$/i, '');
  // Replace separators with spaces
  name = name.replace(/[\-_]+/g, ' ');
  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ').trim();
  // Capitalise first letter
  if (name.length) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}
