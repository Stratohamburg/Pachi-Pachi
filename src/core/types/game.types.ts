import type {
  BallConfig,
  BoardDefinitionV2,
  ObstacleConfig,
  RelicConfig,
  WaveDefinition,
} from './content.types';
import type { PlacementData, PlayerSaveData } from './save.types';

export type AppPage = 'battle' | 'gallery' | 'gacha' | 'lobby' | 'meta-tree' | 'result' | 'settings';

export type GamePhase =
  | 'init'
  | 'lobby'
  | 'battle-ready'
  | 'placement'
  | 'aiming'
  | 'flying'
  | 'settlement'
  | 'reward-choice'
  | 'gameover';

export type RewardKind = 'ball' | 'placement' | 'relic';

export interface RewardChoice {
  id: string;
  kind: RewardKind;
  title: string;
  description: string;
  rarity: number;
  ball?: BallConfig;
  obstacle?: ObstacleConfig;
  placement?: PlacementData;
  relic?: RelicConfig;
}

export interface RunSummary {
  totalScore: number;
  highestWave: number;
  earnedCurrency: number;
  earnedFragments: number;
  unlockedBallIds: number[];
}

export interface BootstrappedGameData {
  board: BoardDefinitionV2;
  saveData: PlayerSaveData;
  waves: WaveDefinition[];
}