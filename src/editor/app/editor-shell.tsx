import { CanvasStage } from '../components/canvas-stage';
import { InspectorPanel } from '../components/inspector-panel';
import { LeftPanel } from '../components/left-panel';
import { ProblemPanel } from '../components/problem-panel';
import { StatusBar } from '../components/status-bar';
import { TopToolbar } from '../components/top-toolbar';

export function EditorShell() {
  return (
    <main className="editor-page">
      <div className="editor-root">
        <TopToolbar />
        <div className="editor-layout">
          <div className="editor-side-column">
            <LeftPanel />
            <InspectorPanel />
          </div>
          <CanvasStage />
        </div>
        <ProblemPanel />
        <StatusBar />
      </div>
    </main>
  );
}
