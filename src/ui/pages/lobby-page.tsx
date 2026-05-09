import { useGameStore } from '../../app/stores/game-store';

export function LobbyPage() {
  const catalog = useGameStore((state) => state.catalog);
  const lastSummary = useGameStore((state) => state.lastSummary);
  const navigate = useGameStore((state) => state.navigate);
  const saveData = useGameStore((state) => state.saveData);
  const startRun = useGameStore((state) => state.startRun);

  if (!catalog || !saveData) {
    return null;
  }

  const entries = [
    {
      action: () => startRun(),
      body: `消耗 ${catalog.constants.energyCostPerRun} 体力进入新的波次 Run。`,
      cta: 'Start Run',
      title: 'Play',
    },
    {
      action: () => navigate('gacha'),
      body: '抽取新的英雄弹珠，扩充局内发球选择。',
      cta: 'Open Gacha',
      title: 'Gacha',
    },
    {
      action: () => navigate('gallery'),
      body: '查看图鉴、物理属性与当前解锁进度。',
      cta: 'Open Gallery',
      title: 'Gallery',
    },
    {
      action: () => navigate('meta-tree'),
      body: '把记忆碎片投入局外成长。',
      cta: 'Open Meta Tree',
      title: 'Meta Tree',
    },
    {
      action: () => navigate('settings'),
      body: '调整画质、音量与输入偏好。',
      cta: 'Open Settings',
      title: 'Settings',
    },
  ];

  return (
    <main className="page page--lobby">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Offline Web MVP</p>
          <h1>霓虹试炼台</h1>
          <p className="hero-copy">
            右下角手柄负责全部输入，局内只调力度不调角度。每一次误差都会被刻度和机关布局记录成你的手感记忆。
          </p>
        </div>
        <div className="resource-strip">
          <div>
            <span>金币</span>
            <strong>{saveData.playerProfile.softCurrency}</strong>
          </div>
          <div>
            <span>体力</span>
            <strong>{saveData.playerProfile.energy}</strong>
          </div>
          <div>
            <span>扭蛋券</span>
            <strong>{saveData.playerProfile.gachaCurrency}</strong>
          </div>
          <div>
            <span>碎片</span>
            <strong>{saveData.playerProfile.memoryFragments}</strong>
          </div>
        </div>
      </section>

      <section className="card-grid">
        {entries.map((entry) => (
          <article key={entry.title} className="menu-card">
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
            <button className="primary-button" onClick={entry.action} type="button">
              {entry.cta}
            </button>
          </article>
        ))}
      </section>

      <section className="summary-card">
        <div>
          <p className="eyebrow">Recent Run</p>
          <h2>{lastSummary ? `最高推进至第 ${lastSummary.highestWave} 波` : '还没有历史对局'}</h2>
        </div>
        <div className="summary-grid">
          <div>
            <span>总分</span>
            <strong>{lastSummary?.totalScore ?? 0}</strong>
          </div>
          <div>
            <span>金币收益</span>
            <strong>{lastSummary?.earnedCurrency ?? 0}</strong>
          </div>
          <div>
            <span>新弹珠</span>
            <strong>{lastSummary?.unlockedBallIds.length ?? 0}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}