import { useEffect, useState } from 'react';
import { useGameStore } from './app/stores/game-store';
import { EditorApp } from './editor/app/editor-app';
import { BattlePage } from './ui/pages/battle-page';
import { GalleryPage } from './ui/pages/gallery-page';
import { GachaPage } from './ui/pages/gacha-page';
import { LobbyPage } from './ui/pages/lobby-page';
import { MetaTreePage } from './ui/pages/meta-tree-page';
import { ResultPage } from './ui/pages/result-page';
import { SettingsPage } from './ui/pages/settings-page';

export function App() {
  const [editorMode, setEditorMode] = useState(() => isEditorRoute());

  useEffect(() => {
    const handleHashChange = () => {
      setEditorMode(isEditorRoute());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return editorMode ? <EditorApp /> : <GameApp />;
}

function GameApp() {
  const clearNotice = useGameStore((state) => state.clearNotice);
  const error = useGameStore((state) => state.error);
  const initialize = useGameStore((state) => state.initialize);
  const notice = useGameStore((state) => state.notice);
  const page = useGameStore((state) => state.page);
  const status = useGameStore((state) => state.status);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      clearNotice();
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [clearNotice, notice]);

  if (status === 'loading') {
    return (
      <main className="page page--status">
        <section className="status-card">
          <p className="eyebrow">Boot Sequence</p>
          <h1>正在加载配置、机台与本地存档</h1>
          <p>首发版本只依赖本地 JSON 和 LocalStorage，不需要服务端。</p>
        </section>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="page page--status">
        <section className="status-card">
          <p className="eyebrow">Boot Failure</p>
          <h1>启动失败</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {page === 'lobby' ? <LobbyPage /> : null}
      {page === 'battle' ? <BattlePage /> : null}
      {page === 'result' ? <ResultPage /> : null}
      {page === 'gacha' ? <GachaPage /> : null}
      {page === 'gallery' ? <GalleryPage /> : null}
      {page === 'meta-tree' ? <MetaTreePage /> : null}
      {page === 'settings' ? <SettingsPage /> : null}

      {notice ? <div className="toast">{notice}</div> : null}
    </div>
  );
}

function isEditorRoute() {
  return window.location.hash.startsWith('#editor');
}