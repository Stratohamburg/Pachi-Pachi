# 技术设计文档 (TDD - Technical Design Document)

## 1. 核心技术栈与实施方案 (Concrete Tech Stack)
为实现“不依赖重度引擎编辑器、高度自由、极小包体、现代化工作流”，本项目确立如下确切的技术实施方案：
* **核心开发语言：** `TypeScript`，提供强类型约束，保证复杂的肉鸽Buff计算与物理对象属性不出现低级运行时错误。
* **工程构建工具：** `Vite`，提供闪电般的热更新（HMR），打包速度快，Rollup底层的Tree-Shaking能把发布包压到极致。
* **2D 渲染层 (Game Canvas)：** `PixiJS (v8+)`。Pixi 提供当前 Web 端最强的 WebGL / WebGPU 2D 渲染性能。我们仅用它渲染机台背景、钉子、弹珠小球以及底层的各种光效与爆炸粒子特效。
* **物理核心运算：** `Matter.js`。完全开源的 2D JavaScript 刚体物理引擎。量量轻巧，极速完成大量小球与钉子的反弹摩擦演算。它在底层纯跑数据（Headless），然后将坐标同步给 Pixi 的 Sprite。
* **DOM 层UI框架 (HUD & 菜单)：** `React (搭配 Zustand)`，负责大厅、HUD、三选一、图鉴与局外成长等全部 DOM 交互层。
  * **重大准则：绝不在 Pixi 中用代码痛苦地画 UI！** 
  * 所有的主界面、肉鸽三选一界面、抽卡界面、外围天赋树，**全部使用标准 Web DOM 元素覆在 Canvas 上层**。通过 CSS/Tailwind 解决适配。
* **音频引擎：** `Howler.js`。处理高频、并发的金属撞击音效以及 BGM 的平滑淡入淡出。
* **当前交付范围：** 当前版本以单人离线 MVP 为目标，局外数据使用本地持久化保存，内置编辑器仅服务团队内容生产；公开 UGC、排行榜、云存档与服务端防作弊属于后续阶段。

## 2. PixiJS 与 Matter.js 桥接策略 (Render & Physics Sync)
由于放弃了大一统引擎，我们需要自己桥接物理与渲染：
* **帧循环分离 (Update Loop)：** 
  * `Matter.Engine.update(delta)` 使用固定时间步长（Fixed Time Step，如 1000/60 ms）执行，保证物理的一致性，防止“穿模”。
  * `Pixi.Ticker` 使用设备的刷新率（如 60hz / 120hz），读取 `Matter.Body.position` 并使用插值（Interpolation）更新 `Pixi.Sprite`，保证高刷屏幕下的视觉极度丝滑。
* **动态响应：** 在初始化与窗口大小调整时（`resize`），根据 `window.innerWidth/innerHeight` 动态判定横竖屏模式。
## 3. 屏幕适配策略 (Responsive System)
* **DOM UI层适配：** 使用标准的 CSS Flexbox/Grid 与媒体查询 (`@media`)，完美适配手机竖屏和PC横屏的菜单展示。右下角的“手柄操作区”本质上就是一个盖在 Canvas 上的透明 DOM 容器层，由 React UI 层直接抛出拖拽事件到 EventBus。
* **游玩区视口 (Viewport)：** 核心的物理游玩区块保持固定的安全宽高比例，采用相机（Camera/Container层级）动态缩放（Zoom）和居中策略适配全屏 Canvas。

## 4. 核心系统架构
* **输入与手柄控制系统：** 从 DOM 层派发代表 `(0.0 ~ 1.0)` 的绝对力度百分比（`Percentage`）传递给引擎库；发射初始方向由关卡中的发射器配置定义，**严禁在 UI 层计算角度、抛物线或落点预览**。
* **物理世界同步：** 严谨的固定帧率更新（FixedUpdate），事件驱动的物理碰撞监听分发（Collision Enter/Stay/Exit）。
* **状态分发中心：** 下方详述包含的核心模块与总线设计。

## 5. 核心类与模块设计 (Core Modules for Developers)
要在代码层面落地，建议采用 **ECS (Entity Component System)** 或 **MVC 结合单例管理器** 的架构。以下是必须实现的核心管理器（Managers）：
* `GameManager (单例)`：游戏主控，负责资源预加载初始化，持有状态机，控制局内生命周期和读取构建产出的 JSON 配置数据。
* `PhysicsManager`：对底层 Matter.js 的二次封装。负责：
  * `createBody/removeBody`: 加载关卡 JSON 解析并实例化物理组件。
  * `onCollisionStart/Active/End`: 将物理引擎的底层碰撞事件拦截，并转换为游戏业务事件封装抛出。
* `InputController`：监听屏幕全局 Touch/Mouse 事件。
  * 状态1：按下 (TouchStart) -> 记录滑轨初始锚点。
  * 状态2：拖拽 (TouchMove) -> 计算沿竖向滑轨的 `power` 百分比并 Clamp(限制) 在最小/最大蓄力区间内，同步 UI 刻度与完美发射反馈。
  * 状态3：释放 (TouchEnd) -> 抛射小球指令。
* `RelicManager` / `PlacementManager` (肉鸽构筑核心)：
  * 负责管理玩家当前收集到的特殊弹珠类型（球袋）以及可以在波次间隙布置的额外物理机关（如高弹柱、传送门）。
  * 配合 `InputController` 在 `STATE_PLACEMENT` 状态下完成局内机关拖拽与落点合法性校验。

### 5.1 配置加载模块草图 (Config Loading Sketch)
为落实“CSV 入库、JSON 运行时消费”的约束，建议将内容加载职责拆成只读仓库层，而不是分散在各业务管理器内直接读取文件。

* `ConfigRepository`：负责加载和缓存 `balls.json`、`props.json` (原 relics)、`obstacles.json`、`global_constants.json`。
  * `loadAll(): Promise<void>` -> 按固定顺序加载全部配置。
  * `getBall(ballId: string): BallConfig`
  * `getProp(propId: string): PropConfig`
  * `getObstacle(obsId: string): ObstacleConfig`
  * `getConstant(key: string): number | string | boolean`
* `BoardRepository`：负责加载底层的机台模板配置（`boards/*.json`），建立基础机台索引。
  * `loadBoard(boardId: string): Promise<BoardDefinition>`
  * `validateBoard(board: BoardDefinition): ValidationResult`
* `WaveRepository`：负责记载单局中的波次难度递增规则、分数阈值。
  * `loadWaveSequence(): Promise<WaveDefinition[]>`
* `SaveRepository`：负责本地持久化读写。
  * `loadProfile(): PlayerSaveData`
  * `saveProfile(data: PlayerSaveData): void`
  * `loadRunSnapshot(): RunSnapshot | null`
  * `clearRunSnapshot(): void`

### 5.2 机台加载与初始化职责 (Board & Wave Loader Responsibilities)
`BoardLoader` 不直接关心 UI，只负责把 `BoardDefinition` 装配为运行时场景：

* 读取 `launcher`，生成发射器初始位置、角度和力度映射区间。
* 读取 `environment`，应用世界重力、边界和安全边距。
* 遍历基础 `entities`，按 `configRef + overrides` 解析出最终物理参数。
* 加载玩家在此前波次中放置的**额外局内机关 (Placements)**，追加到 Entities 中。
* 将所有 `ResolvedEntity` 交给 `PhysicsManager` 创建 Matter Body。
* 返回供 Pixi 渲染层消费的初始显示对象描述。

建议暴露如下最小接口：

```ts
interface BoardLoader {
  buildRuntimeBoard(definition: BoardDefinition, playerPlacements: PlacementData[]): RuntimeBoard;
}

interface RuntimeBoard {
  launcher: LauncherRuntimeData;
  environment: EnvironmentRuntimeData;
  entities: ResolvedEntity[];
}
```

### 5.3 启动与开局时序 (Boot and Run Sequence)
为降低首发版本复杂度，建议统一采用以下时序：

1. `STATE_INIT` 中并行加载资源清单、配置 JSON、本地存档。
2. `GameManager` 根据存档恢复基础大厅状态，不自动恢复旧 Run。
3. 玩家点击 `Play` 后，由 `RunDirector` 初始化本次单局的波次序列（Wave Sequence），加载默认机台模板。
4. `BoardRepository.loadBoard(boardId)` 读取机台定义。
5. `BoardLoader.buildRuntimeBoard()` 解析机台并交给 `PhysicsManager` / `RenderFactory` 建场。
6. 显示波次目标，进入 `STATE_AIMING`，开始本波次交互。
7. 单个波次完成后，由 `RunDirector` 触发肉鸽奖励获取，然后进入 `STATE_PLACEMENT` 允许玩家摆放新机关并进入下一波。

### 5.4 推荐类型边界 (Type Boundaries)
为避免后期把文档字段名直接散落到全工程，建议保留三层类型：

* `RawConfig` / `RawLevelDefinition`：与 JSON 文件字段完全一致。
* `DomainModel`：经校验和默认值补齐后的业务对象。
* `RuntimeModel`：已拆分为 Pixi / Matter / UI 可直接消费的运行时对象。

这样可以把文件格式变更影响限制在加载层，不污染核心玩法逻辑。

### 5.5 推荐工程目录结构 (Suggested Projec波次流程”“渲染层”和“DOM UI 层”保持稳定边界：

```text
configs/
  Balls_Config.csv
  Global_Constants.csv
  Obstacles_Config.csv
  Props_Config.csv
generated/
  config/
    balls.json
    global_constants.json
    obstacles.json
    props.json
  boards/
    board_001.json
  waves/
    wave_sequence.json
src/
  app/
    bootstrap/
    stores/
  core/
    events/
    fsm/
    repositories/
    run/
    save/
    types/
  gameplay/
    input/
    board/
    physics/
    props/
    scoring/
  render/
    factories/
    pixi/
  ui/
    components/
    overlays/
    pages/
    hooks/
```

目录职责建议如下：

* `core/repositories/`：只读内容仓库与本地存档仓库。
* `core/run/`：`RunDirector`、波次(Wave)管理、层间结算。
* `gameplay/`：纯玩法逻辑，包括发射输入控制、道具拖拽放置(Placement)、以及物理得分间结算与种子管理。
* `gameplay/`：纯玩法逻辑，不直接依赖 React 组件。
* `render/`：Pixi 相关显示对象工厂与渲染适配。
* `ui/`：大厅、图鉴、结算、遗物选择等 DOM 页面与弹层。

### 5.6 文件命名约定 (File Naming Rules)
为避免文件名风格混乱，建议固定以下约定：board-loader.ts`。
* 类型声明文件使用 `*.types.ts`，例如 `board.types.ts`、`save.types.ts`。
* 构建脚本使用 `kebab-case.ts`，例如 `build-config.ts`、`validate-boardiceOverlay.tsx`。
* 非 UI 的 TypeScript 模块使用 `kebab-case.ts`，例如 `config-repository.ts`、`run-director.ts`、`level-loader.ts`。
* 类型声明文件使用 `*.types.ts`，例如 `level.types.ts`、`save.types.ts`。
* 构建脚本使用 `kebab-case.ts`，例如 `build-config.ts`、`validate-level.ts`。
* 生成产物文件名与文档约定保持一致，避免运行时再做二次猜测或别名映射。

### 5.7 JSON 对应的 TypeScript 类型草图 (Type Sketch)
下面的类型草图用于约束配置 JSON、关卡 JSON 与本地存档之间的最小公共结构：

```ts
export type EntityType =
  | 'PIN_BASIC'
  | 'BUMPER_ELASTIC'
  | 'BLOCKER_GLASS'
  | 'HOLE_WORMHOLE'
  | 'SLOT_JACKPOTBoardDefinition {
  version: number;
  boardId: string;
  name: string;
  backgroundId: string;
  launcher: {
    position: { x: number; y: number };
    angle: number;
    minForce: number;
    maxForce: number;
  };
  environment: {
    gravity: { x: number; y: number };
    bounds: { width: number; height: number };
    safeMargins: { top: number; right: number; bottom: number; left: number };
  };
  entities: BoardEntity[];
}

export interface BoardEntity {
  id: string;
  type: EntityType;
  // ... 其他坐标、物理覆盖参
}

export interface WaveDefinition {
  waveIndex: number;
  targetScore: number;
  ballsProvided: number;
  rewardOptions: number;
  // ... 其他难度扰动参数
}
```
export interface LevelEntity {
  id: string;
  type: EntityType;
  configRef?: number;
  transform: { x: number; y: number; scale: number; rotation: number };
  physics?: { friction?: number; restitution?: number; isStatic?: boolean };
  params: Record<string, unknown>;
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

export interface PlayerSaveData {
  playerProfile: {
    softCurrency: number;
    energy: number;
    unlockedBalls: number[];
    talents: Record<string, number>;
  };
  settings: {
    masterVolume: number;
    effectsVolume: number;
    quality: 'low' | 'medium' | 'high';
    holdSpaceToCharge: boolean;
  };
  runSnapshot: RunSnapshot | null;
}

export interface RunSnapshot {
  seed: string;
  currentNodeId: string;
  ownedRelics: number[];
  remainingBalls: number;
}
```

这些类型不要求一步到位覆盖全部玩法字段，但首发版本至少应保证字段名、数据类型和空值策略稳定。

## 6. 游戏有限状态机定义 (Game FSM)
由 `GameManager` 驱动的全局枚举流转机制：
* `STATE_INIT`：读取配置，预加载资源图集、音效。
* `STATE_LOBBY`：大厅待机，负责UI展示，可抽卡、升级天赋。
* `STATE_BATTLE_READY`：进入关卡局内，生成地图与障碍。
* `STATE_AIMING`：玩家交互期。时间可能被刻意放慢（TimeScale = 0.5）。
* `STATE_FLYING`：锁定手柄输入，小球飞行，执行各种遗物和碰撞事件检测。
* `STATE_SETTLEMENT`：小球落入底槽（或者死槽），计算倍率，结清分值。如果有残余球数，回到 `STATE_AIMING`；否则进入 `STATE_GAMEOVER`。
* `STATE_GAMEOVER`：本局结束，展示结算结果、局外资源收益与再次开局入口。

### 6.1 RunDirector 职责补充
`RunDirector` 负责单局肉鸽流程编排，不直接操作底层物理对象：

* 生成或读取本次 Run 的节点路线。
* 根据节点类型选择关卡池、商店池或精英奖励池。
* 在关卡结算后判断是发放遗物、切换节点、还是结束 Run。
* 向 `SaveRepository` 写入必要的临时快照，供异常恢复使用。

## 7. 事件总线机制 (Event Bus API)
全局引入一个轻量级的 `EventBus`，用于解耦：
* `EVENT_INPUT_FIRE` (payload: `{ power: number }`)
* `EVENT_PHYSICS_COLLIDE` (payload: `{ bodyA: Entity, bodyB: Entity, velocity: number }`) -> `RelicManager` 高频监听此事件用来挂载爆炸等效果。
* `EVENT_UPDATE_SCORE` (payload: `{ addValue: number, position: Vector2 }`) -> `UIManager` 监听它弹出飘字并更新总分。
* `EVENT_BALL_OUT_OF_BOUNDS` -> 触发一局小球生命周期结束。