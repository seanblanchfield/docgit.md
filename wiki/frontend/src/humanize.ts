// Utility to convert raw file/directory names into a more human-readable form
// e.g. "01_getting_started.md" -> "Getting started"
export function humanizeFileName(raw: string): string {
  // Remove leading digits + separators (e.g. "01_" or "10-")
  let name = raw.replace(/^\d+[\-_ ]+/, '');
  // Strip common markdown/text extensions
  name = name.replace(/\.(md|markdown|txt)$/i, '');
  // Replace underscores & hyphens with space
  name = name.replace(/[\-_]+/g, ' ');
  // Collapse duplicate whitespace and trim
  name = name.replace(/\s+/g, ' ').trim();
  // Capitalise first letter only (preserve acronyms)
  if (name.length) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}
