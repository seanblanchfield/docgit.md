import { Crepe } from '@milkdown/crepe';

import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

const fallbackMarkdown =
  `# Milkdown Editor Crepe (Fallback)

> Could not load content from /api/files/test-doc.md.
> Displaying fallback content.

This is a demo for using [Milkdown](https://milkdown.dev) editor crepe.
`;

interface ApiFileResponse {
  content: string;
}

async function fetchInitialMarkdown(): Promise<string> {
  try {
    const response = await fetch('/api/files/test-doc.md');
    if (!response.ok) {
      console.error(`Error fetching initial markdown: ${response.status} ${response.statusText}`);
      return fallbackMarkdown;
    }
    // Parse response as JSON and expect a 'content' property
    const jsonData: ApiFileResponse = await response.json();
    if (typeof jsonData.content === 'string') {
      return jsonData.content;
    } else {
      console.error('Fetched data does not have a string "content" property:', jsonData);
      return fallbackMarkdown;
    }
  } catch (error) {
    console.error('Network or JSON parsing error fetching initial markdown:', error);
    return fallbackMarkdown;
  }
}

const initialMarkdown = await fetchInitialMarkdown();

await new Crepe({
  root: '#app',
  defaultValue: initialMarkdown,
}).create();
