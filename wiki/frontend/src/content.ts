import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, parserCtx } from '@milkdown/core';
import { Slice } from 'prosemirror-model';

export interface ContentEditor {
  replaceContent(markdown: string): void;
}

export async function initContentEditor(rootSelector: string, defaultValue: string): Promise<ContentEditor> {
  const editor = await new Crepe({
    root: rootSelector,
    defaultValue,
  }).create();

  return {
    replaceContent(markdown: string) {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const doc = parser(markdown);
        if (!doc) return;
        view.dispatch(
          view.state.tr.replace(
            0,
            view.state.doc.content.size,
            new Slice(doc.content, 0, 0)
          )
        );
      });
    },
  };
}
