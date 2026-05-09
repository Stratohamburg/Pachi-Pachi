import type { BallConfig, BoardDefinition, ObstacleConfig, RelicConfig, WaveDefinition } from '../../core/types/content.types';
import type { GamePhase, RewardChoice, RunSummary } from '../../core/types/game.types';
import type { PlacementData } from '../../core/types/save.types';

export interface BattleCatalog {
  allBalls: BallConfig[];
  allRelics: RelicConfig[];
  placementObstacles: ObstacleConfig[];
}

export interface BattleRuntimeOptions {
  board: BoardDefinition;
  waves: WaveDefinition[];
  catalog: BattleCatalog;
  constants: {
    perfectLaunchTolerance: number;
    feverHitCount: number;
    feverMultiplier: number;
    jackpotProbability: number;
  };
  ownedRelicIds?: number[];
  placements?: PlacementData[];
  selectedBallId: number;
  unlockedBallIds: number[];
  onRunComplete?: (summary: RunSummary) => void;
  onSnapshotChange?: (snapshot: BattleSnapshot) => void;
}

export interface ViewportTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
  width: number;
  height: number;
}

export interface BattleWaveHazard {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  penaltyScore: number;
}

export interface BattleWaveMutator {
  title: string;
  description: string;
  drainScale: number;
  jackpotScale: number;
  driftX: number;
  hazards: BattleWaveHazard[];
}

export interface BattleSnapshot {
  phase: GamePhase;
  currentWave: number;
  totalWaves: number;
  waveTargetScore: number;
  totalScore: number;
  waveScore: number;
  combo: number;
  feverHits: number;
  feverHitTarget: number;
  feverActive: boolean;
  feverRemainingMs: number;
  remainingBalls: number;
  unlockedBallIds: number[];
  selectedBallId: number;
  ownedRelicIds: number[];
  placements: PlacementData[];
  rewardChoices: RewardChoice[] | null;
  pendingPlacement: PlacementData | null;
  currentShotScore: number;
  ballPassiveTitle: string;
  ballPassiveDescription: string;
  message: string;
  waveMutatorTitle: string;
  waveMutatorDescription: string;
}