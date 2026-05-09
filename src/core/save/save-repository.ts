import type { PlayerSaveData, RunSnapshot } from '../types/save.types';

const SAVE_STORAGE_KEY = 'pachinko-web-mvp.save.v1';

export const defaultSaveData: PlayerSaveData = {
  playerProfile: {
    softCurrency: 600,
    energy: 50,
    unlockedBalls: [1000],
    talents: {
      FEVER_START: 0,
      STARTING_FUNDS: 0,
    },
    gachaCurrency: 2,
    memoryFragments: 0,
  },
  settings: {
    masterVolume: 0.8,
    effectsVolume: 0.9,
    quality: 'high',
    holdSpaceToCharge: true,
    vibrationEnabled: true,
  },
  runSnapshot: null,
};

export class SaveRepository {
  loadProfile(): PlayerSaveData {
    if (typeof window === 'undefined') {
      return structuredClone(defaultSaveData);
    }

    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return structuredClone(defaultSaveData);
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PlayerSaveData>;
      return mergeSaveData(parsed);
    } catch {
      return structuredClone(defaultSaveData);
    }
  }

  saveProfile(data: PlayerSaveData): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  }

  loadRunSnapshot(): RunSnapshot | null {
    return this.loadProfile().runSnapshot;
  }

  saveRunSnapshot(snapshot: RunSnapshot): void {
    const profile = this.loadProfile();
    profile.runSnapshot = snapshot;
    this.saveProfile(profile);
  }

  clearRunSnapshot(): void {
    const profile = this.loadProfile();
    profile.runSnapshot = null;
    this.saveProfile(profile);
  }

  resetProfile(): PlayerSaveData {
    const reset = structuredClone(defaultSaveData);
    this.saveProfile(reset);
    return reset;
  }
}

function mergeSaveData(parsed: Partial<PlayerSaveData>): PlayerSaveData {
  return {
    playerProfile: {
      ...defaultSaveData.playerProfile,
      ...parsed.playerProfile,
      unlockedBalls: parsed.playerProfile?.unlockedBalls ?? defaultSaveData.playerProfile.unlockedBalls,
      talents: parsed.playerProfile?.talents ?? defaultSaveData.playerProfile.talents,
    },
    settings: {
      ...defaultSaveData.settings,
      ...parsed.settings,
    },
    runSnapshot: parsed.runSnapshot ?? null,
  };
}

export const saveRepository = new SaveRepository();