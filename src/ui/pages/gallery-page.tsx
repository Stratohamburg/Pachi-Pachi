import { useState } from 'react';
import { useGameStore } from '../../app/stores/game-store';

export function GalleryPage() {
  const catalog = useGameStore((state) => state.catalog);
  const navigate = useGameStore((state) => state.navigate);
  const saveData = useGameStore((state) => state.saveData);
  const [selectedBallId, setSelectedBallId] = useState<number>(1000);

  if (!catalog || !saveData) {
    return null;
  }

  const selected = catalog.balls.find((ball) => ball.id === selectedBallId) ?? catalog.balls[0];

  return (
    <main className="page page--sub page--gallery">
      <section className="gallery-layout">
        <div className="gallery-list">
          <div className="title-row">
            <div>
              <p className="eyebrow">Gallery</p>
              <h1>英雄弹珠图鉴</h1>
            </div>
            <button className="ghost-button" onClick={() => navigate('lobby')} type="button">
              返回大厅
            </button>
          </div>
          <div className="card-grid card-grid--gallery">
            {catalog.balls.map((ball) => {
              const unlocked = saveData.playerProfile.unlockedBalls.includes(ball.id);
              return (
                <button
                  key={ball.id}
                  className={`menu-card menu-card--compact ${selectedBallId === ball.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedBallId(ball.id)}
                  type="button"
                >
                  <span className="pill">{unlocked ? 'UNLOCKED' : 'LOCKED'}</span>
                  <h2>{ball.name}</h2>
                  <p>{unlocked ? ball.desc : '尚未解锁，尝试抽卡或局内奖励。'}</p>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="sidebar-card sidebar-card--detail">
          <p className="eyebrow">Ball Detail</p>
          <h2>{selected.name}</h2>
          <p>{selected.desc}</p>
          <div className="summary-grid">
            <div>
              <span>质量</span>
              <strong>{selected.mass}</strong>
            </div>
            <div>
              <span>弹性</span>
              <strong>{selected.bounciness}</strong>
            </div>
            <div>
              <span>半径</span>
              <strong>{selected.radius}</strong>
            </div>
            <div>
              <span>稀有度</span>
              <strong>{selected.rarity}</strong>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}