import type { EntityType } from './content.types';

export interface PlayerProfile {
  softCurrency: number;
  energy: number;
  unlockedBalls: number[];
  talents: Record<string, number>;
  gachaCurrency: number;
  memoryFragments: number;
}

export interface SettingsData {
  masterVolume: number;
  effectsVolume: number;
  quality: 'high' | 'low' | 'medium';
  holdSpaceToCharge: boolean;
  vibrationEnabled: boolean;
}

export interface PlacementData {
  id: string;
  type: Extract<EntityType, 'BLOCKER_GLASS' | 'BUMPER_ELASTIC' | 'PIN_BASIC'>;
  configRef: number;
  x: number;
  y: number;
}

export interface RunSnapshot {
  seed: string;
  boardId: string;
  currentWaveIndex: number;
  ownedRelics: number[];
  ownedPlacements: PlacementData[];
  remainingBalls: number;
  selectedBallId: number;
  totalScore: number;
}

export interface PlayerSaveData {
  playerProfile: PlayerProfile;
  settings: SettingsData;
  runSnapshot: RunSnapshot | null;
}