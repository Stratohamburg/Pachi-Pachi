import { useEditorStore } from '../stores/editor-store';

export function StatusBar() {
  const activeTab = useEditorStore((state) => state.activeTab);
  const camera = useEditorStore((state) => state.camera);
  const continuousPlacement = useEditorStore((state) => state.continuousPlacement);
  const dirty = useEditorStore((state) => state.dirty);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const mode = useEditorStore((state) => state.mode);
  const placementType = useEditorStore((state) => state.placementType);
  const problems = useEditorStore((state) => state.problems);
  const selectedEntityIds = useEditorStore((state) => state.selectedEntityIds);
  const selection = useEditorStore((state) => state.selection);

  const selectionLabel =
    selectedEntityIds.length > 1
      ? `Entities:${selectedEntityIds.length}`
      : selection.kind === 'board'
        ? 'Board'
        : `${selection.kind}:${selection.id}`;

  return (
    <footer className="editor-statusbar">
      <div className="editor-statusbar__group">
        <span>Mode {mode}</span>
        <span>Tab {activeTab}</span>
        <span>Zoom {camera.zoom.toFixed(2)}x</span>
        <span>Place {placementType ?? 'none'}</span>
        <span>Repeat {continuousPlacement ? 'on' : 'off'}</span>
      </div>
      <div className="editor-statusbar__group">
        <span>Selection {selectionLabel}</span>
        <span>{dirty ? 'Unsaved changes' : 'Saved state'}</span>
        <span>{problems.length} Problems</span>
        <span>{lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'No local draft saved'}</span>
      </div>
    </footer>
  );
}
