import { useGameStore } from '../../app/stores/game-store';

export function ResultPage() {
  const lastSummary = useGameStore((state) => state.lastSummary);
  const navigate = useGameStore((state) => state.navigate);
  const startRun = useGameStore((state) => state.startRun);

  if (!lastSummary) {
    return null;
  }

  return (
    <main className="page page--result">
      <section className="hero-card result-card">
        <div>
          <p className="eyebrow">Run Result</p>
          <h1>本局结算</h1>
          <p className="hero-copy">这次 run 的收益已经落到本地存档，下一次开局会继续沿用当前的局外进度。</p>
        </div>
        <div className="summary-grid summary-grid--result">
          <div>
            <span>总分</span>
            <strong>{lastSummary.totalScore}</strong>
          </div>
          <div>
            <span>最高波次</span>
            <strong>{lastSummary.highestWave}</strong>
          </div>
          <div>
            <span>金币收益</span>
            <strong>{lastSummary.earnedCurrency}</strong>
          </div>
          <div>
            <span>碎片收益</span>
            <strong>{lastSummary.earnedFragments}</strong>
          </div>
        </div>

        <div className="chip-grid">
          {lastSummary.unlockedBallIds.length === 0 ? <span className="muted-note">本局没有新的弹珠解锁</span> : null}
          {lastSummary.unlockedBallIds.map((ballId) => (
            <span key={ballId} className="chip-button chip-button--static">
              新弹珠 #{ballId}
            </span>
          ))}
        </div>

        <div className="button-row">
          <button className="primary-button" onClick={() => startRun()} type="button">
            再来一局
          </button>
          <button className="secondary-button" onClick={() => navigate('meta-tree')} type="button">
            前往养成
          </button>
          <button className="ghost-button" onClick={() => navigate('lobby')} type="button">
            返回大厅
          </button>
        </div>
      </section>
    </main>
  );
}