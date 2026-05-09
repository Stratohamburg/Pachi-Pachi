import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../app/stores/game-store';
import { BattleRuntime } from '../../gameplay/battle/battle-runtime';
import type { BattleSnapshot } from '../../gameplay/battle/battle.types';
import { PowerLauncher } from '../components/power-launcher';

export function BattlePage() {
  const catalog = useGameStore((state) => state.catalog);
  const finishRun = useGameStore((state) => state.finishRun);
  const navigate = useGameStore((state) => state.navigate);
  const saveData = useGameStore((state) => state.saveData);
  const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null);
  const runtimeRef = useRef<BattleRuntime | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.body.classList.add('battle-active');

    const host = stageRef.current;
    if (!host || !catalog || !saveData) {
      return () => {
        document.body.classList.remove('battle-active');
      };
    }

    const runtime = new BattleRuntime({
      board: catalog.board,
      catalog: {
        allBalls: catalog.balls,
        allRelics: catalog.relics,
        placementObstacles: catalog.obstacles,
      },
      constants: {
        feverHitCount: catalog.constants.feverHitCount,
        feverMultiplier: catalog.constants.feverMultiplier,
        jackpotProbability: catalog.constants.jackpotProbability,
        perfectLaunchTolerance: catalog.constants.perfectLaunchTolerance,
      },
      onRunComplete: finishRun,
      onSnapshotChange: setSnapshot,
      selectedBallId: saveData.playerProfile.unlockedBalls[0] ?? 1000,
      unlockedBallIds: saveData.playerProfile.unlockedBalls,
      waves: catalog.waves,
    });

    runtimeRef.current = runtime;
    void runtime.mount(host).then(() => {
      setSnapshot(runtime.getSnapshot());
    });

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
      document.body.classList.remove('battle-active');
    };
  }, [catalog, finishRun, saveData]);

  if (!catalog || !saveData) {
    return (
      <main className="page page--battle-loading">
        <section className="status-card">
          <p className="eyebrow">Loading Battle</p>
          <h1>正在装配机台与波次数据</h1>
        </section>
      </main>
    );
  }

  const activeSnapshot: BattleSnapshot = snapshot ?? {
    phase: 'battle-ready',
    currentWave: 1,
    totalWaves: catalog.waves.length,
    waveTargetScore: catalog.waves[0]?.targetScore ?? 0,
    totalScore: 0,
    waveScore: 0,
    combo: 0,
    feverHits: 0,
    feverHitTarget: catalog.constants.feverHitCount,
    feverActive: false,
    feverRemainingMs: 0,
    remainingBalls: catalog.waves[0]?.ballsProvided ?? 0,
    unlockedBallIds: saveData.playerProfile.unlockedBalls,
    selectedBallId: saveData.playerProfile.unlockedBalls[0] ?? 1000,
    ownedRelicIds: [],
    placements: [],
    rewardChoices: null,
    pendingPlacement: null,
    currentShotScore: 0,
    ballPassiveTitle: '标准机芯',
    ballPassiveDescription: '没有极端偏科，适合拿来校准刻度与理解基础路线。',
    message: '正在装配机台与波次数据',
    waveMutatorTitle: '校准波次',
    waveMutatorDescription: '基础机台保持完整结构，没有额外漂移和惩罚区。',
  };

  const currentBall = catalog.balls.find((ball) => ball.id === activeSnapshot.selectedBallId) ?? catalog.balls[0];
  const isLauncherDisabled = activeSnapshot.phase !== 'aiming';

  return (
    <main className="page page--battle">
      <header className="battle-header">
        <div className="hud-block">
          <span>总分</span>
          <strong>{activeSnapshot.totalScore}</strong>
        </div>
        <div className="hud-block">
          <span>波次</span>
          <strong>
            {activeSnapshot.currentWave}/{activeSnapshot.totalWaves}
          </strong>
        </div>
        <div className="hud-block">
          <span>目标</span>
          <strong>{activeSnapshot.waveTargetScore}</strong>
        </div>
        <div className="hud-block">
          <span>Combo</span>
          <strong>{activeSnapshot.combo}</strong>
        </div>
        <div className="hud-block hud-block--fever">
          <span>Fever</span>
          <strong>
            {activeSnapshot.feverHits}/{activeSnapshot.feverHitTarget}
          </strong>
          <div className="fever-bar">
            <div
              className="fever-bar__fill"
              style={{ width: `${(activeSnapshot.feverHits / activeSnapshot.feverHitTarget) * 100}%` }}
            />
          </div>
        </div>
        <div className="hud-block">
          <span>剩余球数</span>
          <strong>{activeSnapshot.remainingBalls}</strong>
        </div>
        <button className="ghost-button" onClick={() => navigate('lobby')} type="button">
          返回大厅
        </button>
      </header>

      <section className="battle-layout">
        <aside className="battle-sidebar">
          <div className="sidebar-card">
            <p className="eyebrow">Current Ball</p>
            <h2>{currentBall?.name}</h2>
            <p>{currentBall?.desc}</p>
            <div className="stack-list">
              <span>{activeSnapshot.ballPassiveTitle}</span>
              <p>{activeSnapshot.ballPassiveDescription}</p>
            </div>
          </div>
          <div className="sidebar-card">
            <p className="eyebrow">Unlocked Balls</p>
            <div className="chip-grid">
              {activeSnapshot.unlockedBallIds.map((ballId) => {
                const ball = catalog.balls.find((entry) => entry.id === ballId);
                return (
                  <button
                    key={ballId}
                    className={`chip-button ${activeSnapshot.selectedBallId === ballId ? 'is-active' : ''}`}
                    onClick={() => runtimeRef.current?.setSelectedBall(ballId)}
                    type="button"
                  >
                    {ball?.name ?? ballId}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sidebar-card">
            <p className="eyebrow">Relics</p>
            <div className="stack-list">
              {activeSnapshot.ownedRelicIds.length === 0 ? <p>尚未获得遗物</p> : null}
              {activeSnapshot.ownedRelicIds.map((relicId) => {
                const relic = catalog.relics.find((entry) => entry.id === relicId);
                return <span key={relicId}>{relic?.title ?? relicId}</span>;
              })}
            </div>
          </div>
        </aside>

        <section className="battle-stage-shell">
          <div
            ref={stageRef}
            className={`battle-stage ${activeSnapshot.phase === 'placement' ? 'is-placement' : ''}`}
            onClick={(event) => {
              if (activeSnapshot.phase !== 'placement') {
                return;
              }

              const rect = event.currentTarget.getBoundingClientRect();
              const runtime = runtimeRef.current;
              if (!runtime) {
                return;
              }

              const point = runtime.toBoardCoordinates(event.clientX - rect.left, event.clientY - rect.top);
              runtime.placePendingPlacement(point);
            }}
          >
            <div className="battle-message">{activeSnapshot.message || ' '} </div>

            {!snapshot ? (
              <div className="overlay-panel">
                <p className="eyebrow">Preparing Runtime</p>
                <h2>初始化 Pixi 画布与 Matter 物理世界</h2>
                <p>{activeSnapshot.message}</p>
              </div>
            ) : null}

            {(activeSnapshot.phase === 'battle-ready' || activeSnapshot.phase === 'settlement') && snapshot && (
              <div className="overlay-panel">
                <p className="eyebrow">Wave Flow</p>
                <h2>{activeSnapshot.phase === 'battle-ready' ? '准备开球' : '本球结算'}</h2>
                <p>{activeSnapshot.message}</p>
                <button className="primary-button" onClick={() => runtimeRef.current?.continue()} type="button">
                  {activeSnapshot.phase === 'battle-ready' ? '开始波次' : '继续发球'}
                </button>
              </div>
            )}

            {activeSnapshot.phase === 'reward-choice' && activeSnapshot.rewardChoices && (
              <div className="overlay-panel overlay-panel--rewards">
                <p className="eyebrow">Reward Choice</p>
                <h2>选择你的下一步构筑</h2>
                <div className="reward-grid">
                  {activeSnapshot.rewardChoices.map((choice) => (
                    <button
                      key={choice.id}
                      className={`reward-card rarity-${choice.rarity}`}
                      onClick={() => runtimeRef.current?.applyReward(choice.id)}
                      type="button"
                    >
                      <span>{choice.kind.toUpperCase()}</span>
                      <strong>{choice.title}</strong>
                      <p>{choice.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSnapshot.phase === 'placement' && (
              <div className="overlay-panel overlay-panel--placement">
                <p className="eyebrow">Placement Mode</p>
                <h2>点击机台空白区域放置机关</h2>
                <p>新的布局会立即作用到下一波的弹道中。</p>
              </div>
            )}
          </div>

          <PowerLauncher
            disabled={isLauncherDisabled}
            holdSpaceToCharge={saveData.settings.holdSpaceToCharge}
            onLaunch={(power) => runtimeRef.current?.launch(power)}
          />
        </section>

        <aside className="battle-controls">
          <div className="sidebar-card">
            <p className="eyebrow">Shot Score</p>
            <h2>{activeSnapshot.currentShotScore}</h2>
            <p>当前小球累计得分</p>
          </div>
          <div className="sidebar-card">
            <p className="eyebrow">Wave Mutator</p>
            <h2>{activeSnapshot.waveMutatorTitle}</h2>
            <p>{activeSnapshot.waveMutatorDescription}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}