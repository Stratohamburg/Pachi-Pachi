import waveSequenceJson from '../../../generated/waves/wave_sequence.json';
import type { WaveDefinition } from '../types/content.types';

export class WaveRepository {
  private readonly waves = waveSequenceJson as WaveDefinition[];

  async loadWaveSequence(): Promise<WaveDefinition[]> {
    return this.waves;
  }
}

export const waveRepository = new WaveRepository();