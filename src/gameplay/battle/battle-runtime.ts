import { Body, Bodies, Composite, Engine, Events, Vector, type IEventCollision, type Pair } from 'matter-js';
import { Application, Container, Graphics } from 'pixi.js';
import type { BallConfig, BoardDefinition, BoardEntity, EntityType, ObstacleConfig, RelicConfig } from '../../core/types/content.types';
import type { GamePhase, RewardChoice, RunSummary } from '../../core/types/game.types';
import type { PlacementData } from '../../core/types/save.types';
import { createRewardChoices } from './create-reward-choices';
import type { BattleRuntimeOptions, BattleSnapshot, BattleWaveHazard, BattleWaveMutator, ViewportTransform } from './battle.types';

const FIXED_STEP_MS = 1000 / 60;
const BOARD_BACKGROUND = 0x0f1627;
const BOARD_BORDER = 0x2f446a;
const BOARD_GLOW = 0x12304d;
const FEVER_COLOR = 0xff315f;
const GHOST_PASS_DISTANCE = 30;

type RuntimeEntityType = EntityType | 'FEVER_BLOCKER' | 'WAVE_HAZARD' | 'WORLD_GUIDE';

interface RuntimeEntity {
  id: string;
  body: Body;
  baseHeight?: number;
  baseWidth?: number;
  display: Graphics;
  height?: number;
  hp?: number;
  maxHp?: number;
  params: Record<string, unknown>;
  scoreBase: number;
  type: RuntimeEntityType;
  width?: number;
}

interface RuntimeBall {
  baseRadius: number;
  body: Body;
  configId: number;
  display: Graphics;
  perfectHitsRemaining: number;
  ghostPassesRemaining: number;
  lastVelocity: { x: number; y: number };
  shotScore: number;
  radiusScale: number;
  rarity: number;
  skillId: number;
  splitTriggered: boolean;
  feverSpawned: boolean;
  launchSpeed: number;
}

interface RelicRule {
  buffType: string;
  buffValue: unknown[];
}

export class BattleRuntime {
  private readonly board: BoardDefinition;
  private readonly boardContainer = new Container();
  private readonly engine = Engine.create();
  private readonly entityByBodyId = new Map<number, RuntimeEntity>();
  private readonly entityById = new Map<string, RuntimeEntity>();
  private readonly ballByBodyId = new Map<number, RuntimeBall>();
  private readonly ballConfigById = new Map<number, BallConfig>();
  private readonly relicById = new Map<number, RelicConfig>();
  private readonly placementOptions = new Map<number, ObstacleConfig>();
  private readonly waveCount: number;
  private currentWaveMutator: BattleWaveMutator;
  private app: Application | null = null;
  private background: Graphics | null = null;
  private disposed = false;
  private initializingApp: Application | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private host: HTMLElement | null = null;
  private tickAccumulatorMs = 0;
  private viewportTransform: ViewportTransform = { offsetX: 0, offsetY: 0, scale: 1, width: 0, height: 0 };
  private phase: GamePhase = 'battle-ready';
  private currentWaveIndex = 0;
  private remainingBalls = 0;
  private totalScore = 0;
  private waveScore = 0;
  private combo = 0;
  private feverHits = 0;
  private feverRemainingMs = 0;
  private currentShotScore = 0;
  private gravityInvertRemainingMs = 0;
  private message = '准备进入第 1 波';
  private rewardChoices: RewardChoice[] | null = null;
  private pendingPlacement: PlacementData | null = null;
  private selectedBallId: number;
  private readonly unlockedBallIds: number[];
  private readonly ownedRelicIds: number[];
  private readonly placements: PlacementData[];
  private readonly newlyUnlockedBallIds: number[] = [];

  constructor(private readonly options: BattleRuntimeOptions) {
    this.board = options.board;
    this.waveCount = options.waves.length;
    this.selectedBallId = options.selectedBallId;
    this.unlockedBallIds = [...options.unlockedBallIds];
    this.ownedRelicIds = [...(options.ownedRelicIds ?? [])];
    this.placements = [...(options.placements ?? [])];
    this.currentWaveMutator = buildWaveMutator(0, options.board);

    this.engine.gravity.scale = 0.001;
    this.engine.gravity.x = this.board.environment.gravity.x;
    this.engine.gravity.y = this.board.environment.gravity.y;

    for (const ball of this.options.catalog.allBalls) {
      this.ballConfigById.set(ball.id, ball);
    }

    for (const relic of this.options.catalog.allRelics) {
      this.relicById.set(relic.id, relic);
    }

    for (const obstacle of this.options.catalog.placementObstacles) {
      this.placementOptions.set(obstacle.id, obstacle);
    }
  }

  async mount(host: HTMLElement): Promise<void> {
    this.disposed = false;
    this.host = host;

    const app = new Application();
    this.initializingApp = app;
    await app.init({
      antialias: true,
      autoDensity: true,
      backgroundAlpha: 0,
      height: host.clientHeight || 1280,
      width: host.clientWidth || 720,
    });

    if (this.disposed || this.host !== host) {
      this.initializingApp = null;
      app.destroy(true, { children: true });
      return;
    }

    this.removeHostCanvases(host);

    app.stage.addChild(this.boardContainer);
    host.appendChild(app.canvas);

    this.app = app;
    this.initializingApp = null;
    this.buildScene();
    this.updateViewport();

    this.resizeObserver = new ResizeObserver(() => {
      this.updateViewport();
    });
    this.resizeObserver.observe(host);

    Events.on(this.engine, 'collisionStart', this.handleCollisionStart);
    app.ticker.add(this.onTick);

    this.prepareWave(0);
  }

  destroy(): void {
    this.disposed = true;

    if (this.initializingApp && this.initializingApp !== this.app) {
      this.initializingApp = null;
    }

    if (this.app) {
      this.app.ticker.remove(this.onTick);
      this.app.destroy(true, { children: true });
      this.app = null;
    }

    if (this.resizeObserver && this.host) {
      this.resizeObserver.unobserve(this.host);
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    Events.off(this.engine, 'collisionStart', this.handleCollisionStart);
    Composite.clear(this.engine.world, false);
    this.entityByBodyId.clear();
    this.entityById.clear();
    this.ballByBodyId.clear();
    this.boardContainer.removeChildren().forEach((child) => child.destroy());
    this.background = null;
    if (this.host) {
      this.removeHostCanvases(this.host);
    }
    this.host = null;
  }

  private removeHostCanvases(host: HTMLElement): void {
    for (const element of Array.from(host.children)) {
      if (element instanceof HTMLCanvasElement) {
        element.remove();
      }
    }
  }

  continue(): boolean {
    if (this.phase === 'battle-ready' || this.phase === 'settlement') {
      this.phase = 'aiming';
      this.message = this.phase === 'aiming' ? '拖拽右下手柄并松开发射' : '';
      this.emitSnapshot();
      return true;
    }

    return false;
  }

  launch(power: number): boolean {
    if (this.phase !== 'aiming' || this.remainingBalls <= 0) {
      return false;
    }

    const ballConfig = this.options.catalog.allBalls.find((ball) => ball.id === this.selectedBallId);
    if (!ballConfig) {
      return false;
    }

    this.phase = 'flying';
    this.remainingBalls -= 1;
    this.combo = 0;
    this.feverHits = 0;
    this.currentShotScore = 0;
    this.message = '';

    const normalizedPower = Math.min(Math.max(power, 0), 1);
    const perfectThreshold = 1 - this.options.constants.perfectLaunchTolerance;
    const speed = this.interpolateLaunchSpeed(normalizedPower);
    const angle = this.degreesToRadians(this.board.launcher.angle);
    const velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };

    this.spawnBall({
      x: this.board.launcher.position.x,
      y: this.board.launcher.position.y,
      velocity,
      configId: ballConfig.id,
      feverSpawned: false,
      perfectHitsRemaining: normalizedPower >= perfectThreshold ? 3 : 0,
      launchSpeed: speed,
    });

    this.emitSnapshot();
    return true;
  }

  applyReward(choiceId: string): boolean {
    if (this.phase !== 'reward-choice' || !this.rewardChoices) {
      return false;
    }

    const choice = this.rewardChoices.find((entry) => entry.id === choiceId);
    if (!choice) {
      return false;
    }

    this.rewardChoices = null;

    if (choice.kind === 'ball' && choice.ball) {
      if (!this.unlockedBallIds.includes(choice.ball.id)) {
        this.unlockedBallIds.push(choice.ball.id);
        this.newlyUnlockedBallIds.push(choice.ball.id);
      }
      this.selectedBallId = choice.ball.id;
      this.message = `获得新弹珠：${choice.ball.name}`;
      this.prepareWave(this.currentWaveIndex + 1);
      return true;
    }

    if (choice.kind === 'relic' && choice.relic) {
      if (!this.ownedRelicIds.includes(choice.relic.id)) {
        this.ownedRelicIds.push(choice.relic.id);
      }
      this.message = `获得遗物：${choice.relic.title}`;
      this.prepareWave(this.currentWaveIndex + 1);
      return true;
    }

    if (choice.kind === 'placement' && choice.obstacle) {
      this.pendingPlacement = {
        id: `placement-${choice.obstacle.id}-${Date.now()}`,
        type: choice.obstacle.type as PlacementData['type'],
        configRef: choice.obstacle.id,
        x: 0,
        y: 0,
      };
      this.phase = 'placement';
      this.message = '点击机台空白区域放置新机关';
      this.emitSnapshot();
      return true;
    }

    return false;
  }

  placePendingPlacement(point: { x: number; y: number }): boolean {
    if (this.phase !== 'placement' || !this.pendingPlacement) {
      return false;
    }

    const boardPoint = point;
    if (!this.isPlacementLegal(boardPoint.x, boardPoint.y)) {
      this.message = '该区域已被占用或超出合法范围';
      this.emitSnapshot();
      return false;
    }

    const placed = {
      ...this.pendingPlacement,
      x: boardPoint.x,
      y: boardPoint.y,
    };

    this.placements.push(placed);
    this.addPlacementEntity(placed);
    this.pendingPlacement = null;
    this.message = '机关布置完成';
    this.prepareWave(this.currentWaveIndex + 1);
    return true;
  }

  setSelectedBall(ballId: number): boolean {
    if (!this.unlockedBallIds.includes(ballId)) {
      return false;
    }

    this.selectedBallId = ballId;
    this.emitSnapshot();
    return true;
  }

  getSnapshot(): BattleSnapshot {
    const wave = this.options.waves[Math.min(this.currentWaveIndex, this.options.waves.length - 1)];

    return {
      phase: this.phase,
      currentWave: this.currentWaveIndex + 1,
      totalWaves: this.waveCount,
      waveTargetScore: wave?.targetScore ?? 0,
      totalScore: this.totalScore,
      waveScore: this.waveScore,
      combo: this.combo,
      feverHits: this.feverHits,
      feverHitTarget: this.options.constants.feverHitCount,
      feverActive: this.feverRemainingMs > 0,
      feverRemainingMs: this.feverRemainingMs,
      remainingBalls: this.remainingBalls,
      unlockedBallIds: [...this.unlockedBallIds],
      selectedBallId: this.selectedBallId,
      ownedRelicIds: [...this.ownedRelicIds],
      placements: [...this.placements],
      rewardChoices: this.rewardChoices ? [...this.rewardChoices] : null,
      pendingPlacement: this.pendingPlacement ? { ...this.pendingPlacement } : null,
      currentShotScore: this.currentShotScore,
      ballPassiveTitle: getBallPassiveInfo(this.selectedBallId).title,
      ballPassiveDescription: getBallPassiveInfo(this.selectedBallId).description,
      message: this.message,
      waveMutatorTitle: this.currentWaveMutator.title,
      waveMutatorDescription: this.currentWaveMutator.description,
    };
  }

  getViewportTransform(): ViewportTransform {
    return this.viewportTransform;
  }

  toBoardCoordinates(localX: number, localY: number): { x: number; y: number } {
    return {
      x: (localX - this.viewportTransform.offsetX) / this.viewportTransform.scale,
      y: (localY - this.viewportTransform.offsetY) / this.viewportTransform.scale,
    };
  }

  private buildScene(): void {
    this.background = this.drawBoardBackground();
    this.boardContainer.addChild(this.background);

    const worldBodies: Body[] = [];

    for (const guide of this.createGuides()) {
      worldBodies.push(guide.body);
      this.entityByBodyId.set(guide.body.id, guide);
      this.entityById.set(guide.id, guide);
      this.boardContainer.addChild(guide.display);
    }

    for (const entity of this.board.entities) {
      const runtimeEntity = this.createEntity(entity);
      worldBodies.push(runtimeEntity.body);
      this.entityByBodyId.set(runtimeEntity.body.id, runtimeEntity);
      this.entityById.set(runtimeEntity.id, runtimeEntity);
      this.boardContainer.addChild(runtimeEntity.display);
    }

    for (const placement of this.placements) {
      const runtimeEntity = this.createPlacementEntity(placement);
      worldBodies.push(runtimeEntity.body);
      this.entityByBodyId.set(runtimeEntity.body.id, runtimeEntity);
      this.entityById.set(runtimeEntity.id, runtimeEntity);
      this.boardContainer.addChild(runtimeEntity.display);
    }

    Composite.add(this.engine.world, worldBodies);
  }

  private createGuides(): RuntimeEntity[] {
    const { width, height } = this.board.environment.bounds;
    const guides: RuntimeEntity[] = [];

    guides.push(this.createGuideRectangle('wall-left', 8, height / 2, 16, height, 0));
    guides.push(this.createGuideRectangle('wall-right', width - 8, height / 2, 16, height, 0));
    guides.push(this.createGuideRectangle('ceiling', width / 2, 8, width, 16, 0));
    guides.push(this.createGuideRectangle('funnel-left', width * 0.27, height * 0.82, width * 0.24, 16, 0.58));
    guides.push(this.createGuideRectangle('funnel-right', width * 0.73, height * 0.82, width * 0.24, 16, -0.58));
    guides.push(this.createGuideRectangle('jackpot-divider-left', width * 0.29, height * 0.93, width * 0.18, 14, -0.24));
    guides.push(this.createGuideRectangle('jackpot-divider-right', width * 0.71, height * 0.93, width * 0.18, 14, 0.24));

    return guides;
  }

  private createGuideRectangle(id: string, x: number, y: number, width: number, height: number, angle: number): RuntimeEntity {
    const body = Bodies.rectangle(x, y, width, height, {
      angle,
      isStatic: true,
      restitution: 0.3,
    });
    const display = new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, 10)
      .fill({ color: BOARD_BORDER, alpha: 0.75 })
      .stroke({ color: BOARD_GLOW, width: 2 });
    display.position.set(x, y);
    display.rotation = angle;

    return {
      id,
      body,
      baseHeight: height,
      baseWidth: width,
      display,
      height,
      params: {},
      scoreBase: 0,
      type: 'WORLD_GUIDE',
      width,
    };
  }

  private createEntity(entity: BoardEntity): RuntimeEntity {
    const config = entity.configRef ? this.placementOptions.get(entity.configRef) ?? this.options.catalog.placementObstacles.find((obstacle) => obstacle.id === entity.configRef) : undefined;
    const scoreBase = config?.scoreBase ?? 0;

    if (entity.type === 'PIN_BASIC' || entity.type === 'BUMPER_ELASTIC') {
      const radius = asNumber(entity.params.radius) ?? (entity.type === 'BUMPER_ELASTIC' ? 24 : 14);
      const body = Bodies.circle(entity.transform.x, entity.transform.y, radius, {
        friction: entity.physics?.friction ?? config?.friction ?? 0.05,
        isStatic: true,
        restitution: entity.physics?.restitution ?? config?.restitution ?? 0.4,
      });
      const display = this.drawCircularEntity(entity.type, radius, config?.maxHp ?? undefined);
      display.position.set(entity.transform.x, entity.transform.y);

      return {
        id: entity.id,
        body,
        display,
        hp: config?.maxHp && config.maxHp > 0 ? config.maxHp : undefined,
        maxHp: config?.maxHp && config.maxHp > 0 ? config.maxHp : undefined,
        params: entity.params,
        scoreBase,
        type: entity.type,
      };
    }

    const width = asNumber(entity.params.width) ?? 124;
    const height = asNumber(entity.params.height) ?? 28;
    const body = Bodies.rectangle(entity.transform.x, entity.transform.y, width, height, {
      angle: this.degreesToRadians(entity.transform.rotation),
      friction: entity.physics?.friction ?? config?.friction ?? 0.2,
      isSensor: entity.type === 'SLOT_DRAIN' || entity.type === 'SLOT_JACKPOT',
      isStatic: true,
      restitution: entity.physics?.restitution ?? config?.restitution ?? 0.1,
    });
    const display = this.drawRectEntity(entity.type, width, height, config?.maxHp ?? undefined);
    display.position.set(entity.transform.x, entity.transform.y);
    display.rotation = this.degreesToRadians(entity.transform.rotation);

    return {
      id: entity.id,
      body,
      baseHeight: height,
      baseWidth: width,
      display,
      height,
      hp: config?.maxHp && config.maxHp > 0 ? config.maxHp : undefined,
      maxHp: config?.maxHp && config.maxHp > 0 ? config.maxHp : undefined,
      params: entity.params,
      scoreBase,
      type: entity.type,
      width,
    };
  }

  private createPlacementEntity(placement: PlacementData): RuntimeEntity {
    const obstacle = this.placementOptions.get(placement.configRef);
    const entity: BoardEntity = {
      id: placement.id,
      type: placement.type,
      configRef: placement.configRef,
      transform: {
        x: placement.x,
        y: placement.y,
        scale: 1,
        rotation: placement.type === 'BLOCKER_GLASS' ? 18 : 0,
      },
      physics: {
        friction: obstacle?.friction,
        restitution: obstacle?.restitution,
        isStatic: true,
      },
      params:
        placement.type === 'BUMPER_ELASTIC'
          ? { bonusScore: 75, impulseMultiplier: 1.2, radius: 22 }
          : placement.type === 'BLOCKER_GLASS'
            ? { breakScore: 120, width: 92, height: 16, maxHp: 3 }
            : { radius: 14 },
    };

    return this.createEntity(entity);
  }

  private addPlacementEntity(placement: PlacementData): void {
    const entity = this.createPlacementEntity(placement);
    this.entityByBodyId.set(entity.body.id, entity);
    this.entityById.set(entity.id, entity);
    this.boardContainer.addChild(entity.display);
    Composite.add(this.engine.world, entity.body);
  }

  private drawBoardBackground(): Graphics {
    const { width, height } = this.board.environment.bounds;
    const background = new Graphics();
    background.roundRect(0, 0, width, height, 48).fill({ color: BOARD_BACKGROUND, alpha: 0.95 }).stroke({ color: BOARD_BORDER, width: 6 });
    background.roundRect(28, 28, width - 56, height - 56, 36).stroke({ color: BOARD_GLOW, width: 2, alpha: 0.65 });

    for (let row = 0; row < 12; row += 1) {
      const y = 140 + row * 82;
      background.moveTo(48, y).lineTo(width - 48, y).stroke({ color: BOARD_GLOW, width: 1, alpha: 0.12 });
    }

    return background;
  }

  private drawCircularEntity(type: RuntimeEntityType, radius: number, maxHp?: number): Graphics {
    const graphic = new Graphics();
    if (type === 'BUMPER_ELASTIC') {
      graphic.circle(0, 0, radius).fill({ color: 0xff9a5e }).stroke({ color: 0xffdf8b, width: 4 });
      graphic.circle(0, 0, radius * 0.58).stroke({ color: 0xffffff, width: 2, alpha: 0.75 });
      return graphic;
    }

    if (type === 'PIN_BASIC') {
      graphic.circle(0, 0, radius).fill({ color: 0xcad4f4 }).stroke({ color: 0xffffff, width: 2, alpha: 0.72 });
      return graphic;
    }

    graphic.circle(0, 0, radius).fill({ color: FEVER_COLOR }).stroke({ color: 0xfff7c7, width: 2 });
    if (maxHp) {
      graphic.alpha = 0.8;
    }
    return graphic;
  }

  private drawRectEntity(type: RuntimeEntityType, width: number, height: number, maxHp?: number): Graphics {
    const graphic = new Graphics();
    this.paintRectEntity(graphic, type, width, height, maxHp);

    return graphic;
  }

  private paintRectEntity(graphic: Graphics, type: RuntimeEntityType, width: number, height: number, maxHp?: number): void {
    graphic.clear();

    if (type === 'BLOCKER_GLASS') {
      graphic.roundRect(-width / 2, -height / 2, width, height, 10).fill({ color: 0x8fd2ff, alpha: 0.45 }).stroke({ color: 0xddf7ff, width: 2, alpha: 0.85 });
      if (maxHp) {
        graphic.alpha = 0.9;
      }
      return;
    }

    if (type === 'SLOT_JACKPOT') {
      graphic.roundRect(-width / 2, -height / 2, width, height, 18).fill({ color: 0xf7b733, alpha: 0.88 }).stroke({ color: 0xfff0b0, width: 3 });
      return;
    }

    if (type === 'SLOT_DRAIN') {
      graphic.roundRect(-width / 2, -height / 2, width, height, 18).fill({ color: 0x742845, alpha: 0.92 }).stroke({ color: 0xc34f79, width: 3 });
      return;
    }

    if (type === 'FEVER_BLOCKER') {
      graphic.roundRect(-width / 2, -height / 2, width, height, 16).fill({ color: 0x5de5ff, alpha: 0.65 }).stroke({ color: 0xf7f8ff, width: 2 });
      return;
    }

    if (type === 'WAVE_HAZARD') {
      graphic.roundRect(-width / 2, -height / 2, width, height, 16).fill({ color: 0xff5e68, alpha: 0.24 }).stroke({ color: 0xffc0b4, width: 2, alpha: 0.9 });
      graphic.moveTo(-width * 0.32, -height * 0.2).lineTo(width * 0.32, height * 0.2).stroke({ color: 0xffc0b4, width: 2, alpha: 0.85 });
      return;
    }

    graphic.roundRect(-width / 2, -height / 2, width, height, 12).fill({ color: BOARD_BORDER, alpha: 0.8 });
  }

  private updateViewport(): void {
    if (!this.app || !this.host) {
      return;
    }

    const width = this.host.clientWidth > 0 ? Math.max(320, this.host.clientWidth) : 320;
    const height = this.host.clientHeight > 0 ? this.host.clientHeight : 480;
    this.app.renderer.resize(width, height);

    const boardWidth = this.board.environment.bounds.width;
    const boardHeight = this.board.environment.bounds.height;
    const scale = Math.min(width / boardWidth, height / boardHeight);
    const offsetX = (width - boardWidth * scale) / 2;
    const offsetY = (height - boardHeight * scale) / 2;

    this.boardContainer.scale.set(scale);
    this.boardContainer.position.set(offsetX, offsetY);
    this.viewportTransform = { offsetX, offsetY, scale, width, height };
  }

  private prepareWave(nextWaveIndex: number): void {
    if (nextWaveIndex >= this.options.waves.length) {
      this.finishRun(true);
      return;
    }

    this.clearTransientBalls();
    this.disableFever();
    this.restoreGravity();

    this.currentWaveIndex = nextWaveIndex;
    this.currentWaveMutator = buildWaveMutator(nextWaveIndex, this.board);
    this.applyWaveMutator(this.currentWaveMutator);
    this.phase = 'battle-ready';
    this.waveScore = 0;
    this.combo = 0;
    this.feverHits = 0;
    this.currentShotScore = 0;
    this.message = `第 ${nextWaveIndex + 1} 波，目标 ${this.options.waves[nextWaveIndex].targetScore} 分；${this.currentWaveMutator.title}`;
    this.remainingBalls = this.calculateWaveBallCount(this.options.waves[nextWaveIndex].ballsProvided);
    this.emitSnapshot();
  }

  private applyWaveMutator(mutator: BattleWaveMutator): void {
    this.resizeSlotEntity('drain_left', mutator.drainScale);
    this.resizeSlotEntity('drain_right', mutator.drainScale);
    this.resizeSlotEntity('jackpot_slot', mutator.jackpotScale);
    this.rebuildWaveHazards(mutator.hazards);
  }

  private resizeSlotEntity(entityId: string, scale: number): void {
    const entity = this.entityById.get(entityId);
    if (!entity?.baseWidth || !entity.baseHeight || !entity.width || !entity.height) {
      return;
    }

    const nextWidth = entity.baseWidth * scale;
    this.resizeRectEntity(entity, nextWidth, entity.baseHeight);
  }

  private resizeRectEntity(entity: RuntimeEntity, width: number, height: number): void {
    if (!entity.width || !entity.height) {
      return;
    }

    Body.scale(entity.body, width / entity.width, height / entity.height);
    entity.width = width;
    entity.height = height;
    this.paintRectEntity(entity.display, entity.type, width, height, entity.maxHp);
    entity.display.position.set(entity.body.position.x, entity.body.position.y);
    entity.display.rotation = entity.body.angle;

    if (entity.type === 'BLOCKER_GLASS') {
      this.updateGlassVisual(entity);
    }
  }

  private rebuildWaveHazards(hazards: BattleWaveHazard[]): void {
    const existingHazards = [...this.entityById.values()].filter((entity) => entity.type === 'WAVE_HAZARD');
    for (const hazard of existingHazards) {
      this.removeEntity(hazard);
    }

    const nextHazards = hazards.map((hazard) => this.createWaveHazard(hazard));
    for (const hazard of nextHazards) {
      this.entityByBodyId.set(hazard.body.id, hazard);
      this.entityById.set(hazard.id, hazard);
      this.boardContainer.addChild(hazard.display);
    }

    Composite.add(this.engine.world, nextHazards.map((hazard) => hazard.body));
  }

  private createWaveHazard(hazard: BattleWaveHazard): RuntimeEntity {
    const body = Bodies.rectangle(hazard.x, hazard.y, hazard.width, hazard.height, {
      isSensor: true,
      isStatic: true,
    });
    const display = this.drawRectEntity('WAVE_HAZARD', hazard.width, hazard.height);
    display.position.set(hazard.x, hazard.y);

    return {
      id: hazard.id,
      body,
      baseHeight: hazard.height,
      baseWidth: hazard.width,
      display,
      height: hazard.height,
      params: { penaltyScore: hazard.penaltyScore },
      scoreBase: 0,
      type: 'WAVE_HAZARD',
      width: hazard.width,
    };
  }

  private calculateWaveBallCount(baseBalls: number): number {
    let result = baseBalls;

    for (const relicId of this.ownedRelicIds) {
      const relic = this.relicById.get(relicId);
      if (relic?.buffType === 'BUFF_STARTING_HP') {
        result += Number(relic.buffValue[0] ?? 0);
      }
    }

    return result;
  }

  private spawnBall(params: {
    x: number;
    y: number;
    velocity: { x: number; y: number };
    configId: number;
    feverSpawned: boolean;
    perfectHitsRemaining: number;
    launchSpeed: number;
  }): RuntimeBall {
    const config = this.ballConfigById.get(params.configId);
    if (!config) {
      throw new Error(`Unknown ball config ${params.configId}.`);
    }

    const radius = 12 * config.radius;
    const body = Bodies.circle(params.x, params.y, radius, {
      friction: 0.006,
      frictionAir: 0.002,
      restitution: config.bounciness,
      slop: 0.02,
    });
    Body.setMass(body, config.mass);
    Body.setVelocity(body, params.velocity);

    const display = new Graphics();
    this.paintBallDisplay(display, config, radius, config.id === 1003 ? 3 : 0);
    display.position.set(params.x, params.y);

    const runtimeBall: RuntimeBall = {
      baseRadius: radius,
      body,
      configId: config.id,
      display,
      perfectHitsRemaining: params.perfectHitsRemaining,
      ghostPassesRemaining: config.id === 1003 ? 3 : 0,
      lastVelocity: { ...params.velocity },
      shotScore: 0,
      radiusScale: 1,
      rarity: config.rarity,
      skillId: config.skillId,
      splitTriggered: false,
      feverSpawned: params.feverSpawned,
      launchSpeed: params.launchSpeed,
    };

    this.ballByBodyId.set(body.id, runtimeBall);
    this.boardContainer.addChild(display);
    Composite.add(this.engine.world, body);

    return runtimeBall;
  }

  private onTick = ({ deltaMS }: { deltaMS: number }) => {
    this.tickAccumulatorMs += Math.min(deltaMS, 100);

    while (this.tickAccumulatorMs >= FIXED_STEP_MS) {
      this.captureBallVelocities();
      Engine.update(this.engine, FIXED_STEP_MS);
      this.tickAccumulatorMs -= FIXED_STEP_MS;
      this.advanceSimulation(FIXED_STEP_MS);
    }

    this.syncBallDisplays();
  };

  private advanceSimulation(stepMs: number): void {
    if (this.feverRemainingMs > 0) {
      this.feverRemainingMs = Math.max(0, this.feverRemainingMs - stepMs);
      if (this.feverRemainingMs === 0) {
        this.disableFever();
      }
    }

    if (this.gravityInvertRemainingMs > 0) {
      this.gravityInvertRemainingMs = Math.max(0, this.gravityInvertRemainingMs - stepMs);
      if (this.gravityInvertRemainingMs === 0) {
        this.restoreGravity();
      }
    }

    if (this.currentWaveMutator.driftX !== 0) {
      for (const ball of this.ballByBodyId.values()) {
        Body.applyForce(ball.body, ball.body.position, {
          x: this.currentWaveMutator.driftX * ball.body.mass,
          y: 0,
        });
      }
    }

    for (const ball of [...this.ballByBodyId.values()]) {
      if (ball.body.position.y > this.board.environment.bounds.height + 120 || ball.body.position.x < -120 || ball.body.position.x > this.board.environment.bounds.width + 120) {
        this.resolveBallLoss(ball, '小球飞出机台');
      }
    }
  }

  private syncBallDisplays(): void {
    for (const ball of this.ballByBodyId.values()) {
      ball.display.position.set(ball.body.position.x, ball.body.position.y);
      ball.display.rotation = ball.body.angle;
    }
  }

  private handleCollisionStart = (event: IEventCollision<Engine>) => {
    for (const pair of event.pairs as Pair[]) {
      this.handlePair(pair.bodyA, pair.bodyB);
      this.handlePair(pair.bodyB, pair.bodyA);
    }
  };

  private handlePair(ballCandidate: Body, entityCandidate: Body): void {
    const ball = this.ballByBodyId.get(ballCandidate.id);
    const entity = this.entityByBodyId.get(entityCandidate.id);

    if (!ball || !entity) {
      return;
    }

    if (!this.ballByBodyId.has(ball.body.id)) {
      return;
    }

    switch (entity.type) {
      case 'PIN_BASIC':
        if (this.tryGhostPass(ball, entity, entity.scoreBase || 10)) {
          break;
        }
        this.registerImpact(ball, entity, entity.scoreBase || 10);
        break;
      case 'BUMPER_ELASTIC':
        this.boostBallSpeed(ball, 1.12, ball.launchSpeed * 0.9);
        this.registerImpact(ball, entity, (entity.scoreBase || 50) + 25);
        break;
      case 'BLOCKER_GLASS':
        this.registerImpact(ball, entity, entity.scoreBase || 20);
        entity.hp = Math.max(0, (entity.hp ?? 3) - this.getGlassDamage(ball));
        this.updateGlassVisual(entity);
        if ((entity.hp ?? 0) <= 0) {
          const breakScore = asNumber(entity.params.breakScore) ?? 140;
          this.addScore(breakScore);
          ball.shotScore += breakScore;
          this.currentShotScore = ball.shotScore;
          this.removeEntity(entity);
        }
        break;
      case 'SLOT_JACKPOT':
        this.resolveJackpot(ball, entity);
        break;
      case 'SLOT_DRAIN':
        this.resolveDrain(ball);
        break;
      case 'WAVE_HAZARD':
        this.resolveWaveHazard(ball, entity);
        break;
      default:
        break;
    }
  }

  private registerImpact(ball: RuntimeBall, entity: RuntimeEntity, baseScore: number): void {
    const velocity = Math.hypot(ball.body.velocity.x, ball.body.velocity.y);
    let score = Math.round(baseScore * Math.max(1, velocity / 11));

    score = this.applyBallImpactModifiers(ball, entity, score);
    score = this.applyRelicScoreModifiers(score, velocity);
    this.addScore(score);

    this.combo += 1;
    this.feverHits += 1;
    ball.shotScore += score;
    this.currentShotScore = ball.shotScore;

    if (ball.perfectHitsRemaining > 0) {
      ball.perfectHitsRemaining -= 1;
      this.boostBallSpeed(ball, 1.08, ball.launchSpeed * 0.92);
    }

    this.applyBallGrowth(ball, entity);

    this.trySplitBall(ball);

    if (this.feverHits >= this.options.constants.feverHitCount && this.feverRemainingMs <= 0) {
      this.triggerFever('Fever Charge Full');
    }

    if (entity.type === 'BUMPER_ELASTIC') {
      entity.display.alpha = 1;
      queueMicrotask(() => {
        entity.display.alpha = 0.92;
      });
    }

    this.emitSnapshot();
  }

  private tryGhostPass(ball: RuntimeBall, entity: RuntimeEntity, baseScore: number): boolean {
    if (ball.configId !== 1003 || ball.ghostPassesRemaining <= 0) {
      return false;
    }

    ball.ghostPassesRemaining -= 1;
    const previousSpeed = Math.max(Math.hypot(ball.lastVelocity.x, ball.lastVelocity.y), ball.launchSpeed * 0.94);
    const previousDirection = normalizeVector(ball.lastVelocity.x, ball.lastVelocity.y, { x: 0, y: -1 });

    this.registerImpact(ball, entity, Math.round(baseScore * 0.85));
    Body.setPosition(ball.body, {
      x: ball.body.position.x + previousDirection.x * (GHOST_PASS_DISTANCE + ball.baseRadius * ball.radiusScale * 0.6),
      y: ball.body.position.y + previousDirection.y * (GHOST_PASS_DISTANCE + ball.baseRadius * ball.radiusScale * 0.6),
    });
    Body.setVelocity(ball.body, {
      x: previousDirection.x * previousSpeed,
      y: previousDirection.y * previousSpeed,
    });
    this.message = ball.ghostPassesRemaining > 0 ? `幽灵球穿透钉阵，剩余 ${ball.ghostPassesRemaining} 次` : '幽灵球穿透次数已耗尽';
    this.refreshBallVisual(ball);
    this.emitSnapshot();
    return true;
  }

  private resolveJackpot(ball: RuntimeBall, entity: RuntimeEntity): void {
    if (!this.ballByBodyId.has(ball.body.id)) {
      return;
    }

    const jackpotScore = Math.round((entity.scoreBase || 500) * 1.4);
    this.addScore(jackpotScore);
    ball.shotScore += jackpotScore;
    this.currentShotScore = ball.shotScore;
    this.feverHits += 18;

    if (Math.random() < this.options.constants.jackpotProbability) {
      this.remainingBalls += 4;
      this.triggerFever('777 Jackpot');
      this.message = '777 命中，进入 Fever';
    } else {
      const extraBalls = 1 + Math.floor(Math.random() * 2);
      this.remainingBalls += extraBalls;
      this.message = `大奖命中，补充 ${extraBalls} 颗弹珠`;
      if (this.feverHits >= this.options.constants.feverHitCount && this.feverRemainingMs <= 0) {
        this.triggerFever('大奖充能溢出');
      }
    }

    this.removeBall(ball);
    this.emitSnapshot();
  }

  private resolveDrain(ball: RuntimeBall): void {
    if (this.tryInvertGravityRelic(ball)) {
      return;
    }

    this.resolveBallLoss(ball, '小球落入吃分槽');
  }

  private resolveWaveHazard(ball: RuntimeBall, entity: RuntimeEntity): void {
    const penaltyScore = asNumber(entity.params.penaltyScore) ?? 120;
    this.removeScore(penaltyScore);
    this.combo = 0;
    this.feverHits = Math.max(0, this.feverHits - 6);
    this.message = `误触惩罚区，扣除 ${penaltyScore} 分`;
    Body.setVelocity(ball.body, {
      x: ball.body.velocity.x * 0.9,
      y: Math.max(ball.body.velocity.y, 4),
    });
    this.emitSnapshot();
  }

  private tryInvertGravityRelic(ball: RuntimeBall): boolean {
    const rule = this.findRelicRule('BUFF_INVERT_GRAVITY_ON_DRAIN');
    if (!rule || Math.random() > 0.18) {
      return false;
    }

    const durationSeconds = Number(rule.buffValue[0] ?? 3);
    this.gravityInvertRemainingMs = durationSeconds * 1000;
    this.engine.gravity.y = -Math.abs(this.board.environment.gravity.y) * 0.85;
    this.message = '重力反转，险中求生';
    this.boostBallSpeed(ball, 1.15, ball.launchSpeed * 0.85);
    Body.setVelocity(ball.body, {
      x: ball.body.velocity.x,
      y: -Math.max(Math.abs(ball.body.velocity.y), ball.launchSpeed * 0.88),
    });
    this.emitSnapshot();
    return true;
  }

  private restoreGravity(): void {
    this.gravityInvertRemainingMs = 0;
    this.engine.gravity.y = this.board.environment.gravity.y;
  }

  private triggerFever(reason: string): void {
    if (this.feverRemainingMs > 0) {
      return;
    }

    this.feverRemainingMs = 8000;
    this.message = reason;
    this.enableFeverBlockers();

    for (let index = 0; index < 4; index += 1) {
      const x = 200 + index * 100;
      const velocity = {
        x: (Math.random() - 0.5) * 6,
        y: 8 + Math.random() * 4,
      };
      this.spawnBall({
        x,
        y: 150,
        velocity,
        configId: this.selectedBallId,
        feverSpawned: true,
        perfectHitsRemaining: 0,
        launchSpeed: 14,
      });
    }

    this.emitSnapshot();
  }

  private enableFeverBlockers(): void {
    const drains = [...this.entityById.values()].filter((entity) => entity.type === 'SLOT_DRAIN');
    const blockers: RuntimeEntity[] = [];

    for (const drain of drains) {
      const width = 112;
      const height = 16;
      const body = Bodies.rectangle(drain.body.position.x, drain.body.position.y - 42, width, height, {
        isStatic: true,
        restitution: 0.85,
      });
      const display = this.drawRectEntity('FEVER_BLOCKER', width, height);
      display.position.set(drain.body.position.x, drain.body.position.y - 42);
      const blocker: RuntimeEntity = {
        id: `fever-blocker-${drain.id}`,
        body,
        display,
        params: {},
        scoreBase: 0,
        type: 'FEVER_BLOCKER',
      };

      blockers.push(blocker);
      this.entityByBodyId.set(body.id, blocker);
      this.entityById.set(blocker.id, blocker);
      this.boardContainer.addChild(display);
    }

    Composite.add(this.engine.world, blockers.map((blocker) => blocker.body));
  }

  private disableFever(): void {
    this.feverRemainingMs = 0;
    const blockers = [...this.entityById.values()].filter((entity) => entity.type === 'FEVER_BLOCKER');
    for (const blocker of blockers) {
      this.removeEntity(blocker);
    }
  }

  private trySplitBall(ball: RuntimeBall): void {
    const rule = this.findRelicRule('BUFF_SPLIT_ON_COMBO');
    if (!rule || ball.splitTriggered) {
      return;
    }

    const threshold = Number(rule.buffValue[0] ?? 10);
    const spawnCount = Number(rule.buffValue[1] ?? 2);
    if (this.combo < threshold) {
      return;
    }

    ball.splitTriggered = true;
    const baseSpeed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y);
    const normalized = Vector.normalise(ball.body.velocity);

    for (let index = 0; index < spawnCount; index += 1) {
      const spread = (index - (spawnCount - 1) / 2) * 0.22;
      const direction = Vector.rotate(normalized, spread);
      this.spawnBall({
        x: ball.body.position.x,
        y: ball.body.position.y,
        velocity: {
          x: direction.x * Math.max(baseSpeed * 0.92, 11),
          y: direction.y * Math.max(baseSpeed * 0.92, 11),
        },
        configId: ball.configId,
        feverSpawned: false,
        perfectHitsRemaining: 0,
        launchSpeed: Math.max(baseSpeed, 11),
      });
    }

    this.message = '细胞分裂触发，多球追加';
  }

  private applyRelicScoreModifiers(score: number, velocity: number): number {
    let total = score;
    const kineticRule = this.findRelicRule('BUFF_SCORE_MULTIPLIER');

    if (kineticRule && velocity >= 10) {
      total = Math.round(total * Number(kineticRule.buffValue[0] ?? 1));
    }

    const explosionRule = this.findRelicRule('BUFF_EXPLOSION_CHANCE');
    if (explosionRule && Math.random() < Number(explosionRule.buffValue[0] ?? 0)) {
      total += Number(explosionRule.buffValue[1] ?? 200);
      this.message = '雷区触发，范围爆炸加分';
    }

    if (this.feverRemainingMs > 0) {
      total = Math.round(total * this.options.constants.feverMultiplier);
    }

    return total;
  }

  private applyBallImpactModifiers(ball: RuntimeBall, entity: RuntimeEntity, score: number): number {
    if (ball.configId === 1002 && (entity.type === 'PIN_BASIC' || entity.type === 'BUMPER_ELASTIC')) {
      return Math.round(score * 1.45);
    }

    if (ball.configId === 1004) {
      return Math.round(score * (1 + Math.min(0.28, (ball.radiusScale - 1) * 0.7)));
    }

    return score;
  }

  private applyBallGrowth(ball: RuntimeBall, entity: RuntimeEntity): void {
    if (ball.configId !== 1004) {
      return;
    }

    if (entity.type !== 'PIN_BASIC' && entity.type !== 'BUMPER_ELASTIC' && entity.type !== 'BLOCKER_GLASS') {
      return;
    }

    if (ball.radiusScale >= 1.45) {
      return;
    }

    const growthFactor = Math.min(1.04, 1.45 / ball.radiusScale);
    Body.scale(ball.body, growthFactor, growthFactor);
    ball.radiusScale *= growthFactor;
    this.refreshBallVisual(ball);
  }

  private getGlassDamage(ball: RuntimeBall): number {
    if (ball.configId === 1001) {
      return 2;
    }

    return 1;
  }

  private findRelicRule(buffType: string): RelicRule | null {
    for (const relicId of this.ownedRelicIds) {
      const relic = this.relicById.get(relicId);
      if (relic?.buffType === buffType) {
        return relic;
      }
    }

    return null;
  }

  private addScore(score: number): void {
    this.totalScore += score;
    this.waveScore += score;
  }

  private removeScore(score: number): void {
    this.totalScore = Math.max(0, this.totalScore - score);
    this.waveScore = Math.max(0, this.waveScore - score);
  }

  private boostBallSpeed(ball: RuntimeBall, multiplier: number, minSpeed: number): void {
    const currentSpeed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y);
    if (currentSpeed <= 0) {
      return;
    }

    const targetSpeed = Math.max(minSpeed, currentSpeed * multiplier);
    const nextVelocity = {
      x: (ball.body.velocity.x / currentSpeed) * targetSpeed,
      y: (ball.body.velocity.y / currentSpeed) * targetSpeed,
    };

    Body.setVelocity(ball.body, nextVelocity);
  }

  private resolveBallLoss(ball: RuntimeBall, reason: string): void {
    if (!this.ballByBodyId.has(ball.body.id)) {
      return;
    }

    this.message = reason;
    this.removeBall(ball);
    this.emitSnapshot();
  }

  private captureBallVelocities(): void {
    for (const ball of this.ballByBodyId.values()) {
      ball.lastVelocity = {
        x: ball.body.velocity.x,
        y: ball.body.velocity.y,
      };
    }
  }

  private removeBall(ball: RuntimeBall): void {
    Composite.remove(this.engine.world, ball.body);
    this.ballByBodyId.delete(ball.body.id);
    this.boardContainer.removeChild(ball.display);
    ball.display.destroy();

    if (this.ballByBodyId.size === 0 && this.phase === 'flying') {
      this.finishShot();
    }
  }

  private finishShot(): void {
    const wave = this.options.waves[this.currentWaveIndex];
    if (!wave) {
      return;
    }

    if (this.waveScore >= wave.targetScore) {
      if (this.currentWaveIndex >= this.options.waves.length - 1) {
        this.finishRun(true);
        return;
      }

      this.phase = 'reward-choice';
      this.rewardChoices = createRewardChoices({
        catalog: this.options.catalog,
        ownedRelicIds: this.ownedRelicIds,
        unlockedBallIds: this.unlockedBallIds,
      });
      this.message = '波次完成，选择一项构筑奖励';
      this.emitSnapshot();
      return;
    }

    if (this.remainingBalls <= 0) {
      this.finishRun(false);
      return;
    }

    this.phase = 'settlement';
    this.message = `本球结算 ${this.currentShotScore} 分，继续尝试`;
    this.emitSnapshot();
  }

  private finishRun(cleared: boolean): void {
    this.phase = 'gameover';
    const summary: RunSummary = {
      totalScore: this.totalScore,
      highestWave: cleared ? this.options.waves.length : this.currentWaveIndex + (this.waveScore >= this.options.waves[this.currentWaveIndex].targetScore ? 1 : 0),
      earnedCurrency: Math.max(120, Math.floor(this.totalScore / 12)),
      earnedFragments: Math.max(1, Math.ceil((this.currentWaveIndex + 1) / 2)),
      unlockedBallIds: [...this.newlyUnlockedBallIds],
    };

    this.message = cleared ? 'Run Clear' : '本局结束';
    this.emitSnapshot();
    this.options.onRunComplete?.(summary);
  }

  private clearTransientBalls(): void {
    for (const ball of [...this.ballByBodyId.values()]) {
      Composite.remove(this.engine.world, ball.body);
      this.boardContainer.removeChild(ball.display);
      ball.display.destroy();
    }
    this.ballByBodyId.clear();
  }

  private removeEntity(entity: RuntimeEntity): void {
    Composite.remove(this.engine.world, entity.body);
    this.entityByBodyId.delete(entity.body.id);
    this.entityById.delete(entity.id);
    this.boardContainer.removeChild(entity.display);
    entity.display.destroy();
  }

  private updateGlassVisual(entity: RuntimeEntity): void {
    if (entity.type !== 'BLOCKER_GLASS') {
      return;
    }

    const ratio = (entity.hp ?? 0) / Math.max(entity.maxHp ?? 1, 1);
    entity.display.alpha = 0.3 + ratio * 0.6;
  }

  private paintBallDisplay(graphic: Graphics, config: BallConfig, radius: number, ghostPassesRemaining: number): void {
    graphic.clear();
    graphic.circle(0, 0, radius).fill({ color: ballColor(config.id, config.rarity), alpha: config.id === 1003 ? 0.55 : 1 }).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });

    if (config.id === 1003 && ghostPassesRemaining > 0) {
      graphic.circle(0, 0, radius + 2).stroke({ color: 0x8df6ff, width: 2, alpha: 0.85 });
    }

    if (config.id === 1004) {
      graphic.circle(0, 0, radius * 0.34).fill({ color: 0xffd2e8, alpha: 0.6 });
    }
  }

  private refreshBallVisual(ball: RuntimeBall): void {
    const config = this.ballConfigById.get(ball.configId);
    if (!config) {
      return;
    }

    this.paintBallDisplay(ball.display, config, ball.baseRadius, ball.ghostPassesRemaining);
    ball.display.scale.set(ball.radiusScale);
  }

  private isPlacementLegal(x: number, y: number): boolean {
    const { width, height } = this.board.environment.bounds;
    const safe = this.board.environment.safeMargins;
    if (x < safe.left + 36 || x > width - safe.right - 36) {
      return false;
    }
    if (y < safe.top + 160 || y > height - safe.bottom - 180) {
      return false;
    }

    for (const entity of this.entityById.values()) {
      if (entity.type === 'SLOT_DRAIN' || entity.type === 'SLOT_JACKPOT' || entity.type === 'WORLD_GUIDE' || entity.type === 'FEVER_BLOCKER') {
        continue;
      }

      const dx = entity.body.position.x - x;
      const dy = entity.body.position.y - y;
      if (Math.hypot(dx, dy) < 84) {
        return false;
      }
    }

    return true;
  }

  private interpolateLaunchSpeed(power: number): number {
    const min = this.board.launcher.minForce;
    const max = this.board.launcher.maxForce;
    return (min + (max - min) * power) * 850;
  }

  private degreesToRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private emitSnapshot(): void {
    this.options.onSnapshotChange?.(this.getSnapshot());
  }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function buildWaveMutator(waveIndex: number, board: BoardDefinition): BattleWaveMutator {
  const { width, height } = board.environment.bounds;

  if (waveIndex <= 0) {
    return {
      title: '校准波次',
      description: '基础机台保持完整结构，没有额外漂移和惩罚区。',
      drainScale: 1,
      jackpotScale: 1,
      driftX: 0,
      hazards: [],
    };
  }

  if (waveIndex === 1) {
    return {
      title: '压缩边槽',
      description: '左右死槽变宽，中央出现一条惩罚热区，误触会扣分并清空连击。',
      drainScale: 1.22,
      jackpotScale: 0.9,
      driftX: 0,
      hazards: [
        {
          id: 'hazard-midline',
          x: width / 2,
          y: height * 0.63,
          width: 180,
          height: 34,
          penaltyScore: 120,
        },
      ],
    };
  }

  return {
    title: '偏航乱流',
    description: '双侧惩罚区持续压缩走位，并有横向乱流轻推小球轨迹。',
    drainScale: 1.42,
    jackpotScale: 0.78,
    driftX: 0.0000045,
    hazards: [
      {
        id: 'hazard-left-wing',
        x: width * 0.31,
        y: height * 0.58,
        width: 122,
        height: 30,
        penaltyScore: 150,
      },
      {
        id: 'hazard-right-wing',
        x: width * 0.69,
        y: height * 0.7,
        width: 122,
        height: 30,
        penaltyScore: 150,
      },
    ],
  };
}

function getBallPassiveInfo(ballId: number): { title: string; description: string } {
  if (ballId === 1001) {
    return {
      title: '破甲重压',
      description: '玻璃挡板每次承受 2 点伤害，适合直接砸穿隐藏路径。',
    };
  }

  if (ballId === 1002) {
    return {
      title: '精准猎分',
      description: '命中普通钉与高弹柱时获得额外得分倍率，越细的路线越值钱。',
    };
  }

  if (ballId === 1003) {
    return {
      title: '相位穿透',
      description: '前 3 次普通钉碰撞会直接穿透并保持原有速度。',
    };
  }

  if (ballId === 1004) {
    return {
      title: '弹性质变',
      description: '每次有效碰撞都会轻微膨胀，后续碰撞面积和得分会同步上升。',
    };
  }

  return {
    title: '标准机芯',
    description: '没有极端偏科，适合拿来校准刻度与理解基础路线。',
  };
}

function normalizeVector(x: number, y: number, fallback: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length <= 0.0001) {
    return fallback;
  }

  return {
    x: x / length,
    y: y / length,
  };
}

function ballColor(ballId: number, rarity: number): number {
  if (ballId === 1001) {
    return 0x7b7e94;
  }

  if (ballId === 1002) {
    return 0x59d6ff;
  }

  if (ballId === 1003) {
    return 0xe8f2ff;
  }

  if (ballId === 1004) {
    return 0xff91c8;
  }

  return rarity >= 3 ? 0xffd27a : 0xf1f5ff;
}