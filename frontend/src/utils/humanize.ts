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

// Utility to format relative time for commit dates
// Examples: "2 minutes ago", "3 hours ago", "yesterday", "2 days ago"
export function humanizeTime(isoDateString: string): string {
  const date = new Date(isoDateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    // For older dates, show the actual date
    return date.toLocaleDateString();
  }
}
