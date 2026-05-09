import { create } from 'zustand';
import { bootstrapGame } from '../../core/bootstrap/bootstrap-game';
import { configRepository } from '../../core/repositories/config-repository';
import { saveRepository } from '../../core/save/save-repository';
import type { BoardDefinition, ObstacleConfig, RelicConfig, WaveDefinition, BallConfig } from '../../core/types/content.types';
import type { AppPage, RunSummary } from '../../core/types/game.types';
import type { PlayerSaveData, SettingsData } from '../../core/types/save.types';

export interface AppCatalog {
  balls: BallConfig[];
  relics: RelicConfig[];
  obstacles: ObstacleConfig[];
  board: BoardDefinition;
  waves: WaveDefinition[];
  constants: {
    energyCostPerRun: number;
    feverHitCount: number;
    feverMultiplier: number;
    jackpotProbability: number;
    perfectLaunchTolerance: number;
  };
}

interface GameStoreState {
  status: 'error' | 'loading' | 'ready';
  error: string | null;
  notice: string | null;
  page: AppPage;
  catalog: AppCatalog | null;
  saveData: PlayerSaveData | null;
  lastSummary: RunSummary | null;
  lastGachaBallId: number | null;
  initialize: () => Promise<void>;
  clearNotice: () => void;
  navigate: (page: AppPage) => void;
  startRun: () => boolean;
  finishRun: (summary: RunSummary) => void;
  performGacha: () => number | null;
  resetSave: () => void;
  updateSettings: (patch: Partial<SettingsData>) => void;
  upgradeTalent: (talentKey: string) => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  status: 'loading',
  error: null,
  notice: null,
  page: 'lobby',
  catalog: null,
  saveData: null,
  lastSummary: null,
  lastGachaBallId: null,

  initialize: async () => {
    if (get().status === 'ready' && get().catalog && get().saveData) {
      return;
    }

    set({ error: null, status: 'loading' });

    try {
      const boot = await bootstrapGame();

      const catalog: AppCatalog = {
        balls: configRepository.listBalls(),
        relics: configRepository.listRelics(),
        obstacles: configRepository.listObstacles(),
        board: boot.board,
        waves: boot.waves,
        constants: {
          energyCostPerRun: configRepository.getConstant<number>('ENERGY_COST_PER_RUN'),
          feverHitCount: configRepository.getConstant<number>('FEVER_HIT_COUNT'),
          feverMultiplier: configRepository.getConstant<number>('FEVER_MULTIPLIER'),
          jackpotProbability: configRepository.getConstant<number>('SLOT_JACKPOT_PROBABILITY'),
          perfectLaunchTolerance: configRepository.getConstant<number>('PERFECT_LAUNCH_TOLERANCE'),
        },
      };

      set({
        catalog,
        error: null,
        page: 'lobby',
        saveData: boot.saveData,
        status: 'ready',
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        status: 'error',
      });
    }
  },

  clearNotice: () => {
    set({ notice: null });
  },

  navigate: (page) => {
    set({ page });
  },

  startRun: () => {
    const { catalog, saveData } = get();
    if (!catalog || !saveData) {
      return false;
    }

    if (saveData.playerProfile.energy < catalog.constants.energyCostPerRun) {
      set({ notice: '体力不足，先通过结算或重置存档恢复资源。' });
      return false;
    }

    const nextSave = {
      ...saveData,
      playerProfile: {
        ...saveData.playerProfile,
        energy: saveData.playerProfile.energy - catalog.constants.energyCostPerRun,
      },
      runSnapshot: null,
    } satisfies PlayerSaveData;

    saveRepository.saveProfile(nextSave);

    set({
      lastSummary: null,
      notice: null,
      page: 'battle',
      saveData: nextSave,
    });

    return true;
  },

  finishRun: (summary) => {
    const { saveData } = get();
    if (!saveData) {
      return;
    }

    const unlockedBalls = Array.from(new Set([...saveData.playerProfile.unlockedBalls, ...summary.unlockedBallIds]));
    const nextSave = {
      ...saveData,
      playerProfile: {
        ...saveData.playerProfile,
        gachaCurrency: saveData.playerProfile.gachaCurrency + 1,
        memoryFragments: saveData.playerProfile.memoryFragments + summary.earnedFragments,
        softCurrency: saveData.playerProfile.softCurrency + summary.earnedCurrency,
        unlockedBalls,
      },
      runSnapshot: null,
    } satisfies PlayerSaveData;

    saveRepository.saveProfile(nextSave);

    set({
      lastSummary: summary,
      notice: '本局奖励已写入本地存档。',
      page: 'result',
      saveData: nextSave,
    });
  },

  performGacha: () => {
    const { catalog, saveData } = get();
    if (!catalog || !saveData) {
      return null;
    }

    if (saveData.playerProfile.gachaCurrency <= 0) {
      set({ notice: '扭蛋资源不足，继续开局可获得新的抽卡机会。' });
      return null;
    }

    const lockedBalls = catalog.balls.filter((ball) => !saveData.playerProfile.unlockedBalls.includes(ball.id));
    const pool = lockedBalls.length > 0 ? lockedBalls : catalog.balls;
    const result = pool[Math.floor(Math.random() * pool.length)];
    const alreadyUnlocked = saveData.playerProfile.unlockedBalls.includes(result.id);
    const unlockedBalls = alreadyUnlocked
      ? saveData.playerProfile.unlockedBalls
      : [...saveData.playerProfile.unlockedBalls, result.id];
    const nextSave = {
      ...saveData,
      playerProfile: {
        ...saveData.playerProfile,
        gachaCurrency: saveData.playerProfile.gachaCurrency - 1,
        softCurrency: saveData.playerProfile.softCurrency + (alreadyUnlocked ? 180 : 0),
        unlockedBalls,
      },
    } satisfies PlayerSaveData;

    saveRepository.saveProfile(nextSave);

    set({
      lastGachaBallId: result.id,
      notice: alreadyUnlocked ? '重复弹珠已折算为 180 金币。' : `新弹珠 ${result.name} 已加入图鉴。`,
      saveData: nextSave,
    });

    return result.id;
  },

  resetSave: () => {
    const reset = saveRepository.resetProfile();
    set({
      lastGachaBallId: null,
      lastSummary: null,
      notice: '本地存档已重置。',
      page: 'lobby',
      saveData: reset,
    });
  },

  updateSettings: (patch) => {
    const { saveData } = get();
    if (!saveData) {
      return;
    }

    const nextSave = {
      ...saveData,
      settings: {
        ...saveData.settings,
        ...patch,
      },
    } satisfies PlayerSaveData;

    saveRepository.saveProfile(nextSave);
    set({ notice: '设置已保存。', saveData: nextSave });
  },

  upgradeTalent: (talentKey) => {
    const { saveData } = get();
    if (!saveData) {
      return;
    }

    if (saveData.playerProfile.memoryFragments <= 0) {
      set({ notice: '记忆碎片不足，完成更多波次后再来。' });
      return;
    }

    const nextSave = {
      ...saveData,
      playerProfile: {
        ...saveData.playerProfile,
        memoryFragments: saveData.playerProfile.memoryFragments - 1,
        talents: {
          ...saveData.playerProfile.talents,
          [talentKey]: (saveData.playerProfile.talents[talentKey] ?? 0) + 1,
        },
      },
    } satisfies PlayerSaveData;

    saveRepository.saveProfile(nextSave);
    set({ notice: '天赋升级完成。', saveData: nextSave });
  },
}));