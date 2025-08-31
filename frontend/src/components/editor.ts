import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core';
import { nord } from '@milkdown/theme-nord';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { menu } from '@milkdown-lab/plugin-menu';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { getMarkdown, replaceAll } from '@milkdown/utils';
import { stateService } from '../services/state.service';

export interface ContentEditor {
  replaceContent(markdown: string): void;
  getMarkdown(): string;
  setReadonly(readonly: boolean): void;
  readonly editor: Editor;
}

class EditorController implements ContentEditor {
  public readonly editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  replaceContent(markdown: string): void {
    this.editor.action(replaceAll(markdown));
  }

  getMarkdown(): string {
    return this.editor.action(getMarkdown());
  }

  setReadonly(readonly: boolean): void {
    this.editor.config((ctx) => {
      ctx.set(editorViewOptionsCtx, { editable: () => !readonly });
    });
  }
}

export async function initContentEditor(element: HTMLElement, initialContent: string): Promise<ContentEditor> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, element);
      ctx.set(defaultValueCtx, initialContent);
            ctx.set(editorViewOptionsCtx, { editable: () => true }); // Initially editable
      const listener = ctx.get(listenerCtx);
                  listener.markdownUpdated((_ctx: any, markdown: string) => {
        stateService.updateCurrentMarkdown(markdown);
      });
    })
    .use(nord)
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(menu)
    .use(listener)
    .create();

  return new EditorController(editor);
}
