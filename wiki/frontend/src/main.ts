import { Crepe } from '@milkdown/crepe';

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css';

const markdown =
  `# Milkdown Editor Crepe

> This is a demo for using [Milkdown](https://milkdown.dev) editor crepe.

`

await new Crepe({
  root: '#app',
  defaultValue: markdown,
}).create()
