export type EntityType =
  | 'PIN_BASIC'
  | 'BUMPER_ELASTIC'
  | 'BLOCKER_GLASS'
  | 'HOLE_WORMHOLE'
  | 'SLOT_JACKPOT'
  | 'SLOT_DRAIN'
  | 'SPAWNER_EXTRA'
  | 'SPINNER_WINDMILL'
  | 'PLATFORM_MOBILE'
  | 'SLOT_MACHINE_TRIGGER';

export type BoardVersion = 1 | 2;
export type DecorationLayer = 'background' | 'foreground';

export interface Vector2 {
  x: number;
  y: number;
}

export interface TransformData extends Vector2 {
  scale: number;
  rotation: number;
}

export interface LauncherDefinition {
  position: Vector2;
  angle: number;
  minForce: number;
  maxForce: number;
}

export interface EnvironmentBounds {
  width: number;
  height: number;
}

export interface SafeMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface EnvironmentDefinition {
  gravity: Vector2;
  bounds: EnvironmentBounds;
  safeMargins: SafeMargins;
}

export interface PhysicsOverrides {
  friction?: number;
  restitution?: number;
  isStatic?: boolean;
  density?: number;
  isSensor?: boolean;
}

export interface BoardDecoration {
  id: string;
  spriteId: string;
  layer: DecorationLayer;
  transform: TransformData;
  opacity?: number;
}

export interface EditorMeta {
  snapEnabled?: boolean;
  snapSize?: number;
  lastZoom?: number;
  lastCamera?: Vector2;
  guideVisible?: boolean;
}

export interface BoardEntity {
  id: string;
  type: EntityType;
  configRef?: number;
  transform: TransformData;
  physics?: PhysicsOverrides;
  params: Record<string, unknown>;
}

export interface BoardDefinitionBase {
  boardId: string;
  levelId?: string;
  name: string;
  backgroundId: string;
  launcher: LauncherDefinition;
  environment: EnvironmentDefinition;
  entities: BoardEntity[];
}

export interface BoardDefinitionV1 extends BoardDefinitionBase {
  version: 1;
}

export interface BoardDefinitionV2 extends BoardDefinitionBase {
  version: 2;
  decorations?: BoardDecoration[];
  editorMeta?: EditorMeta;
}

export type BoardDefinition = BoardDefinitionV1 | BoardDefinitionV2;

export interface PinBasicParams {
  radius: number;
}

export interface BumperElasticParams {
  radius: number;
  impulseMultiplier: number;
  scoreValue?: number;
}

export interface BlockerGlassRectParams {
  shape: 'rect';
  width: number;
  height: number;
}

export interface BlockerGlassPolygonParams {
  shape: 'polygon';
  vertices: Vector2[];
}

export type BlockerGlassParams = BlockerGlassRectParams | BlockerGlassPolygonParams;

export interface HoleWormholeParams {
  radius: number;
  pairId: string;
  cooldownMs?: number;
}

export interface SlotJackpotParams {
  width: number;
  height: number;
  rewardId: string;
  multiplier?: number;
}

export interface SlotDrainParams {
  width: number;
  height: number;
  drainMode?: 'fail' | 'return' | 'score';
  rewardId?: string;
}

export interface SpawnerExtraParams {
  spawnBallId: number;
  spawnCount: number;
  triggerId: string;
  cooldownMs?: number;
}

export interface SpinnerWindmillParams {
  armLength: number;
  armCount: 2 | 3 | 4;
  startAngle?: number;
}

export interface PlatformMobileParams {
  width: number;
  height: number;
  path: Vector2[];
  speed: number;
  loop?: boolean;
  pingPong?: boolean;
}

export interface SlotMachineTriggerParams {
  width: number;
  height: number;
  rewardTableId: string;
  consumeBall?: boolean;
}

export interface WaveDefinition {
  waveIndex: number;
  targetScore: number;
  ballsProvided: number;
  rewardOptions: number;
  boardId: string;
}

export interface BallConfig {
  id: number;
  name: string;
  rarity: number;
  mass: number;
  bounciness: number;
  radius: number;
  skillId: number;
  desc: string;
}

export interface RelicConfig {
  id: number;
  title: string;
  tier: number;
  weight: number;
  buffType: string;
  buffValue: unknown[];
  synergyTag: number;
  desc: string;
}

export interface ObstacleConfig {
  id: number;
  type: EntityType;
  scoreBase: number;
  friction: number;
  restitution: number;
  maxHp: number;
  desc: string;
}

export type GlobalConstantPrimitive = boolean | number | string;

export interface GlobalConstantEntry<TValue extends GlobalConstantPrimitive = GlobalConstantPrimitive> {
  value: TValue;
  type: 'BOOLEAN' | 'FLOAT' | 'INT' | 'STRING';
  desc: string;
}

export type GlobalConstants = Record<string, GlobalConstantEntry>;