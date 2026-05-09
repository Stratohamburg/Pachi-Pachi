import { useEffect } from 'react';
import { EditorShell } from './editor-shell';
import { useEditorStore } from '../stores/editor-store';

export function EditorApp() {
  const clearNotice = useEditorStore((state) => state.clearNotice);
  const initialize = useEditorStore((state) => state.initialize);
  const notice = useEditorStore((state) => state.notice);

  useEffect(() => {
    initialize();
    document.body.classList.add('editor-active');
    return () => {
      document.body.classList.remove('editor-active');
    };
  }, [initialize]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      clearNotice();
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [clearNotice, notice]);

  return (
    <>
      <EditorShell />
      {notice ? <div className="toast">{notice}</div> : null}
    </>
  );
}
