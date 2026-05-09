import { useRef, type ChangeEvent } from 'react';
import type { EditorMode } from '../types/editor.types';
import { importBoardFromFile } from '../serializers/board-import';
import { useEditorStore } from '../stores/editor-store';

const MODES: Array<{ mode: EditorMode; label: string; disabled?: boolean }> = [
  { mode: 'select', label: 'Select' },
  { mode: 'pan', label: 'Pan' },
  { mode: 'place', label: 'Place', disabled: true },
  { mode: 'vertex-edit', label: 'Vertex', disabled: true },
  { mode: 'play-test', label: 'Play Test', disabled: true },
];

export function TopToolbar() {
  const board = useEditorStore((state) => state.board);
  const clearNotice = useEditorStore((state) => state.clearNotice);
  const exportBoardJson = useEditorStore((state) => state.exportBoardJson);
  const importBoardFromText = useEditorStore((state) => state.importBoardFromText);
  const loadSampleBoard = useEditorStore((state) => state.loadSampleBoard);
  const mode = useEditorStore((state) => state.mode);
  const problems = useEditorStore((state) => state.problems);
  const resetBoard = useEditorStore((state) => state.resetBoard);
  const saveDraft = useEditorStore((state) => state.saveDraft);
  const setMode = useEditorStore((state) => state.setMode);
  const validate = useEditorStore((state) => state.validate);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const errorCount = problems.filter((problem) => problem.severity === 'error').length;
  const warningCount = problems.filter((problem) => problem.severity === 'warning').length;

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    try {
      const boardDefinition = await importBoardFromFile(file);
      importBoardFromText(JSON.stringify(boardDefinition));
    } catch (error) {
      clearNotice();
      const message = error instanceof Error ? error.message : '导入失败。';
      window.alert(message);
    } finally {
      event.currentTarget.value = '';
    }
  };

  const handleExport = () => {
    const json = exportBoardJson();
    if (!json) {
      return;
    }

    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${board.boardId || 'board_export'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="editor-toolbar">
      <div className="editor-toolbar__row">
        <div className="editor-toolbar__group editor-toolbar__group--file">
          <button className="ghost-button" onClick={() => { window.location.hash = ''; }} type="button">
            返回游戏
          </button>
          <button className="ghost-button" onClick={resetBoard} type="button">
            New
          </button>
          <button className="ghost-button" onClick={loadSampleBoard} type="button">
            Load Sample
          </button>
          <button className="ghost-button" onClick={() => inputRef.current?.click()} type="button">
            Import JSON
          </button>
          <input accept="application/json,.json" hidden onChange={handleImportChange} ref={inputRef} type="file" />
          <button className="ghost-button" onClick={saveDraft} type="button">
            Save Draft
          </button>
          <button className="primary-button" onClick={handleExport} type="button">
            Export JSON
          </button>
        </div>

        <div className="editor-toolbar__group editor-toolbar__group--status">
          <button className="ghost-button" onClick={validate} type="button">
            Validate
          </button>
          <div className="editor-toolbar__status">
            <span className={`editor-badge ${errorCount > 0 ? 'editor-badge--error' : ''}`}>Errors {errorCount}</span>
            <span className={`editor-badge ${warningCount > 0 ? 'editor-badge--warning' : ''}`}>Warnings {warningCount}</span>
          </div>
        </div>
      </div>

      <div className="editor-toolbar__row editor-toolbar__row--secondary">
        <div className="editor-toolbar__group editor-toolbar__group--modes">
          <span className="editor-toolbar__label">Tools</span>
          {MODES.map((entry) => (
            <button
              className={`chip-button ${mode === entry.mode ? 'is-active' : ''}`}
              disabled={entry.disabled}
              key={entry.mode}
              onClick={() => setMode(entry.mode)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
