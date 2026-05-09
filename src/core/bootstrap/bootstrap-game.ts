import { boardRepository } from '../repositories/board-repository';
import { configRepository } from '../repositories/config-repository';
import { waveRepository } from '../repositories/wave-repository';
import { saveRepository } from '../save/save-repository';
import type { BootstrappedGameData } from '../types/game.types';

export async function bootstrapGame(): Promise<BootstrappedGameData> {
  await configRepository.loadAll();

  const [board, waves] = await Promise.all([
    boardRepository.loadBoard('board_001'),
    waveRepository.loadWaveSequence(),
  ]);
  const saveData = saveRepository.loadProfile();

  return {
    board,
    saveData,
    waves,
  };
}