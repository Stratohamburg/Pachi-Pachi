import ballsJson from '../../../generated/config/balls.json';
import constantsJson from '../../../generated/config/global_constants.json';
import obstaclesJson from '../../../generated/config/obstacles.json';
import relicsJson from '../../../generated/config/relics.json';
import type {
  BallConfig,
  GlobalConstantEntry,
  GlobalConstants,
  ObstacleConfig,
  RelicConfig,
} from '../types/content.types';

export class ConfigRepository {
  private readonly balls = ballsJson as Record<string, BallConfig>;
  private readonly constants = constantsJson as GlobalConstants;
  private readonly obstacles = obstaclesJson as Record<string, ObstacleConfig>;
  private readonly relics = relicsJson as Record<string, RelicConfig>;
  private loaded = false;

  async loadAll(): Promise<void> {
    this.loaded = true;
  }

  listBalls(): BallConfig[] {
    this.ensureLoaded();
    return Object.values(this.balls).sort((left, right) => left.id - right.id);
  }

  getBall(ballId: number): BallConfig {
    this.ensureLoaded();
    const ball = this.balls[String(ballId)];
    if (!ball) {
      throw new Error(`Unknown ball id ${ballId}.`);
    }
    return ball;
  }

  listRelics(): RelicConfig[] {
    this.ensureLoaded();
    return Object.values(this.relics).sort((left, right) => left.id - right.id);
  }

  getRelic(relicId: number): RelicConfig {
    this.ensureLoaded();
    const relic = this.relics[String(relicId)];
    if (!relic) {
      throw new Error(`Unknown relic id ${relicId}.`);
    }
    return relic;
  }

  listObstacles(): ObstacleConfig[] {
    this.ensureLoaded();
    return Object.values(this.obstacles).sort((left, right) => left.id - right.id);
  }

  getObstacle(obstacleId: number): ObstacleConfig {
    this.ensureLoaded();
    const obstacle = this.obstacles[String(obstacleId)];
    if (!obstacle) {
      throw new Error(`Unknown obstacle id ${obstacleId}.`);
    }
    return obstacle;
  }

  getConstant<TValue extends boolean | number | string>(key: string): TValue {
    this.ensureLoaded();
    const entry = this.constants[key] as GlobalConstantEntry<TValue> | undefined;
    if (!entry) {
      throw new Error(`Unknown global constant ${key}.`);
    }
    return entry.value;
  }

  listConstants(): GlobalConstants {
    this.ensureLoaded();
    return this.constants;
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('ConfigRepository.loadAll() must complete before reading config data.');
    }
  }
}

export const configRepository = new ConfigRepository();