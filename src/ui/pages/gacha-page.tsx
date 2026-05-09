import { useGameStore } from '../../app/stores/game-store';

export function GachaPage() {
  const catalog = useGameStore((state) => state.catalog);
  const lastGachaBallId = useGameStore((state) => state.lastGachaBallId);
  const navigate = useGameStore((state) => state.navigate);
  const performGacha = useGameStore((state) => state.performGacha);
  const saveData = useGameStore((state) => state.saveData);

  if (!catalog || !saveData) {
    return null;
  }

  const resultBall = lastGachaBallId ? catalog.balls.find((ball) => ball.id === lastGachaBallId) : null;

  return (
    <main className="page page--sub">
      <section className="hero-card narrow-card">
        <p className="eyebrow">Gacha Machine</p>
        <h1>扭蛋工坊</h1>
        <p className="hero-copy">首发 MVP 采用短演出与结果直出。抽到重复弹珠会自动折算成金币。</p>

        <div className="resource-strip">
          <div>
            <span>扭蛋券</span>
            <strong>{saveData.playerProfile.gachaCurrency}</strong>
          </div>
          <div>
            <span>已解锁弹珠</span>
            <strong>{saveData.playerProfile.unlockedBalls.length}</strong>
          </div>
        </div>

        <div className="gacha-machine">
          <div className="gacha-machine__capsule" />
          <button className="primary-button" disabled={saveData.playerProfile.gachaCurrency <= 0} onClick={() => performGacha()} type="button">
            消耗 1 张扭蛋券
          </button>
        </div>

        <div className="sidebar-card">
          <p className="eyebrow">Latest Result</p>
          <h2>{resultBall?.name ?? '等待下一次抽取'}</h2>
          <p>{resultBall?.desc ?? '当前没有新的抽卡结果。'}</p>
        </div>

        <button className="ghost-button" onClick={() => navigate('lobby')} type="button">
          返回大厅
        </button>
      </section>
    </main>
  );
}