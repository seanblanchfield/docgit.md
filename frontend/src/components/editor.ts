import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, parserCtx } from '@milkdown/core';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { Slice } from 'prosemirror-model';

export interface ContentEditor {
  replaceContent(markdown: string): Promise<void>;
  getMarkdown(): string;
  setEditable(editable: boolean): void;
  cleanupForRead(): void;
}

export async function initContentEditor(
  rootSelector: string,
  defaultValue: string,
  onEdit: (markdown: string) => void
): Promise<ContentEditor> {
  const crepe = new Crepe({
    root: rootSelector,
    defaultValue,
  });

  crepe.editor.use(listener);
  crepe.editor.use((ctx) => {
    const listener = ctx.get(listenerCtx);
    listener.markdownUpdated((_ctx, markdown) => {
      onEdit(markdown);
    });
  });

  await crepe.create();

  return {
    async replaceContent(markdown: string): Promise<void> {
      return new Promise((resolve) => {
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const parser = ctx.get(parserCtx);
          const doc = parser(markdown);
          if (!doc) {
            resolve();
            return;
          }
          view.dispatch(
            view.state.tr.replace(
              0,
              view.state.doc.content.size,
              new Slice(doc.content, 0, 0)
            )
          );
          // Use requestAnimationFrame to ensure DOM updates complete
          requestAnimationFrame(() => resolve());
        });
      });
    },
    getMarkdown(): string {
      // crepe typings may not expose getMarkdown; cast to any
      return (crepe as any).getMarkdown?.() ?? '';
    },
    setEditable(editable: boolean) {
      crepe.setReadonly(!editable);
    },
    cleanupForRead() {
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const lastNode = state.doc.lastChild;
        if (lastNode && lastNode.isTextblock && lastNode.content.size === 0) {
          const pos = state.doc.content.size - 2; // position before last empty paragraph
          const tr = state.tr.delete(pos, state.doc.content.size);
          view.dispatch(tr);
        }
        // remove selection and blur
        view.dom.blur();
      });
    }
  };
}
