# 关卡编辑器设计文档 (Level Editor Design Spec)

## 0. 文档定位
本文档描述的是现在就要开发的内部关卡编辑器，不是远期愿景稿。目标是让前端、运行时、内容策划三方都能直接据此拆任务、定义数据结构并实现。

编辑器定位如下：

* 面向团队内部的 PC 桌面工具，不做移动端适配。
* 输出物为可直接进入游戏运行时的关卡 JSON。
* 编辑器需要覆盖当前规划中的全部核心玩法组件，包括：各种钉子、自定义挡板、弹珠落点区域、大奖槽、老虎机触发器、额外生成器、风车/旋转机关、移动平台、传送门/黑洞、纯视觉装饰。
* 文档中所有功能均属于当前开发范围，但允许按照依赖顺序拆分开发阶段。

## 1. 目标与非目标

### 1.1 当前目标
* 提供一个所见即所得的 2D 机台编辑器，支持画布编辑、属性面板编辑、导入、导出、校验、试玩。
* 支持导出完整的机台定义，包括顶层 `launcher`、`environment`、`entities` 和纯视觉装饰层。
* 支持基于当前编辑结果直接进入模拟测试模式。
* 支持高密度柏青哥布局常见的批量操作，如镜像、阵列、路径散布、批量替换和框选复制。

### 1.2 非目标
* 不做多人协作、评论、锁定、云同步。
* 不做通用型引擎编辑器能力，不支持任意脚本节点图。
* 不做复杂 3D 视图，仅聚焦 2D 柏青哥盘面编辑。

## 2. 运行时数据目标与 Schema 约束

### 2.1 数据目标
当前运行时已经存在 `BoardDefinition`、`launcher`、`environment`、`entities` 的基础结构。为了让编辑器覆盖现在要做的全部功能，编辑器输出需要从现有 `board_001.json` 的 `v1` 结构扩展为兼容导入 `v1`、默认导出 `v2` 的结构。

原则如下：

* `launcher` 和 `environment` 是顶层配置，不是可拖拽实体。
* 会参与 Matter 物理世界的对象放在 `entities`。
* 纯视觉装饰不进入 Matter，放在单独的 `decorations` 中。
* 编辑器专用信息不污染运行时主结构，统一放到 `editorMeta`。

### 2.2 目标顶层结构

```ts
interface BoardDefinitionV2 {
  version: 2;
  boardId: string;
  levelId?: string;
  name: string;
  backgroundId: string;
  launcher: LauncherDefinition;
  environment: EnvironmentDefinition;
  entities: BoardEntityV2[];
  decorations?: BoardDecoration[];
  editorMeta?: EditorMeta;
}

interface LauncherDefinition {
  position: { x: number; y: number };
  angle: number;
  minForce: number;
  maxForce: number;
}

interface EnvironmentDefinition {
  gravity: { x: number; y: number };
  bounds: { width: number; height: number };
  safeMargins: { top: number; right: number; bottom: number; left: number };
}

interface EditorMeta {
  snapEnabled?: boolean;
  snapSize?: number;
  lastZoom?: number;
  lastCamera?: { x: number; y: number };
  guideVisible?: boolean;
}
```

### 2.3 实体类型枚举
当前要做的功能意味着运行时类型要扩展。建议目标枚举如下：

```ts
type EntityType =
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
```

说明如下：

* `PIN_BASIC`：普通钉子。
* `BUMPER_ELASTIC`：弹力柱/高反弹机关。
* `BLOCKER_GLASS`：矩形或多边形挡板，自定义挡板统一归于此类。
* `HOLE_WORMHOLE`：成对传送门/黑洞。
* `SLOT_JACKPOT`：大奖槽。
* `SLOT_DRAIN`：普通落点槽、失败槽、回收槽。
* `SPAWNER_EXTRA`：额外生成器，用于关卡机制触发时追加生成球体。
* `SPINNER_WINDMILL`：风车/旋转十字。
* `PLATFORM_MOBILE`：移动平台。
* `SLOT_MACHINE_TRIGGER`：老虎机触发区域。

### 2.4 实体通用结构

```ts
interface PhysicsOverridesV2 {
  friction?: number;
  restitution?: number;
  isStatic?: boolean;
  density?: number;
  isSensor?: boolean;
}

interface BoardEntityV2 {
  id: string;
  type: EntityType;
  configRef?: number;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  physics?: PhysicsOverridesV2;
  params: Record<string, unknown>;
}

interface BoardDecoration {
  id: string;
  spriteId: string;
  layer: 'background' | 'foreground';
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  opacity?: number;
}
```

## 3. 编辑器总布局

编辑器采用标准桌面生产力布局：顶部工具栏、左侧资源与模式区、中间画布、右侧属性面板、底部状态栏/问题栏。

### 3.1 顶部工具栏 (Top Toolbar)
固定高度 `56px`，分为六个功能组：

* **文件组：** `New`、`Open`、`Import JSON`、`Save`、`Export JSON`。
* **历史组：** `Undo`、`Redo`。
* **模式组：** `Select`、`Place`、`Vertex Edit`、`Pan`、`Play Test`。
* **批量工具组：** `Mirror`、`Array`、`Distribute Along Path`、`Duplicate`、`Delete`。
* **显示组：** `Snap`、`Grid`、`Safe Zone`、`Debug Bounds`、`Show IDs`。
* **校验组：** `Validate`、`Problems`。

强制要求：

* 所有危险操作需要二次确认，仅 `Undo` 可逆的操作不弹确认。
* `Export JSON` 前必须自动执行一次完整校验。
* `Play Test` 仅在无阻塞级错误时可进入。

### 3.2 左侧面板 (Palette & Outline)
固定宽度 `280px`，采用页签结构：`Palette`、`Board`、`Outline`。

#### `Palette` 页签
用于放置新对象，按分类组织：

* **基础元件：** `PIN_BASIC`、`BUMPER_ELASTIC`、`BLOCKER_GLASS`。
* **槽位与触发：** `SLOT_DRAIN`、`SLOT_JACKPOT`、`SLOT_MACHINE_TRIGGER`。
* **特殊机制：** `HOLE_WORMHOLE`、`SPAWNER_EXTRA`、`SPINNER_WINDMILL`、`PLATFORM_MOBILE`。
* **装饰：** `Decoration`。

约束如下：

* `launcher` 不出现在 `Palette`，它属于顶层 Board 配置，由 `Board` 页签和画布手柄共同编辑。
* 每个条目都需要小图标、名称、默认参数模板。
* 点击条目进入放置模式；拖拽条目可直接拖入画布。

#### `Board` 页签
用于编辑顶层配置：

* 基础信息：`boardId`、`levelId`、`name`、`backgroundId`。
* 发射器：`position.x`、`position.y`、`angle`、`minForce`、`maxForce`。
* 环境：`gravity.x`、`gravity.y`、`bounds.width`、`bounds.height`、`safeMargins.*`。

#### `Outline` 页签
用于显示结构树：

* 分组顺序：`Launcher`、`Environment`、`Entities`、`Decorations`。
* 支持搜索、按类型筛选、按 ID 快速跳转。
* 支持多选、锁定、隐藏、聚焦。

### 3.3 中央画布区 (Canvas / Stage)
占据主工作区，承载完整 2D 机台编辑视图。

画布要求如下：

* 背景默认显示网格与刻度。
* 居中绘制 `environment.bounds` 指定的机台范围。
* 在机台范围内叠加 `9:16` 安全游玩区辅助框。
* 画布支持缩放、平移、框选、对齐吸附。
* 已选对象显示包围盒、旋转手柄、锚点。
* 多边形挡板选中后进入顶点编辑模式，逐点调整 `vertices`。
* 移动平台选中后显示路径点与方向箭头。
* 传送门选中后高亮同 `pairId` 的另一端。
* 老虎机触发区和落点槽使用半透明彩色叠层显示触发体积。

### 3.4 右侧属性面板 (Inspector)
固定宽度 `340px`，内容随当前选中对象变化。

#### 未选中对象时
显示 Board Inspector：

* `General`：关卡基础信息。
* `Launcher`：发射器参数。
* `Environment`：重力、边界、安全边距。
* `Validation Summary`：当前错误/警告统计。

#### 选中实体时
显示 Entity Inspector：

* `Identity`：`id`、`type`、`configRef`。
* `Transform`：`x`、`y`、`scale`、`rotation`。
* `Physics`：`friction`、`restitution`、`isStatic`、`density`、`isSensor`。
* `Params`：按实体类型切换不同表单。
* `Runtime Preview`：显示导出后的 JSON 片段，方便策划和程序对照。

#### 选中装饰时
显示 Decoration Inspector：

* `spriteId`
* `layer`
* `x`、`y`、`scale`、`rotation`
* `opacity`

### 3.5 底部状态栏与问题面板
底部高度 `28px` 的状态栏常驻，问题面板可展开。

状态栏显示：

* 当前模式
* 当前缩放比例
* 当前网格尺寸
* 当前选中对象数
* 当前鼠标坐标

问题面板显示：

* `Error`、`Warning`、`Info` 三类问题
* 点击问题可定位到画布对象或 Board 字段
* 导出失败时自动展开并聚焦第一条错误

## 4. 编辑交互与快捷键

### 4.1 核心模式
* `Select`：单选、多选、框选、拖拽、旋转、复制。
* `Place`：从 Palette 放置新对象，Esc 退出。
* `Vertex Edit`：编辑多边形挡板顶点。
* `Pan`：平移画布。
* `Play Test`：切到运行时模拟。

### 4.2 快捷键
* `Ctrl+S`：保存
* `Ctrl+Z`：撤销
* `Ctrl+Shift+Z`：重做
* `Delete`：删除选中对象
* `Ctrl+D`：复制
* `F`：聚焦当前选中对象
* `G`：开关网格吸附
* `M`：进入镜像工具
* `Space + Drag`：平移

### 4.3 批量工具
当前必须实现以下批量能力：

* **Mirror**：以画布中心线或自定义参考线做左右镜像。
* **Array**：按行列复制对象，输入间距和数量。
* **Distribute Along Path**：在一条折线或贝塞尔路径上均匀散布钉子。
* **Replace Type**：批量将一组 `PIN_BASIC` 替换为 `BUMPER_ELASTIC` 等。

## 5. 实体类型与参数契约

这一节定义的是可直接实现的表单和导出协议。所有实体的 Inspector 都必须按以下契约输出 `params`。

### 5.1 `PIN_BASIC`
用途：普通钉子。

必填字段：

* `params.radius: number`

可选字段：

* `configRef`
* `physics.friction`
* `physics.restitution`

放置规则：

* 默认圆形碰撞体。
* 支持网格放置、路径散布、镜像复制。

### 5.2 `BUMPER_ELASTIC`
用途：弹力柱、高反弹钉。

必填字段：

* `params.radius: number`
* `params.impulseMultiplier: number`

可选字段：

* `params.scoreValue: number`

### 5.3 `BLOCKER_GLASS`
用途：矩形挡板或自定义多边形挡板。

必填字段：

* `params.shape: 'rect' | 'polygon'`

当 `shape = 'rect'` 时：

* `params.width: number`
* `params.height: number`

当 `shape = 'polygon'` 时：

* `params.vertices: Array<{ x: number; y: number }>`

约束：

* 多边形至少 3 个点。
* 不允许自相交。
* 导出前自动统一为局部坐标。

### 5.4 `HOLE_WORMHOLE`
用途：成对传送门、黑洞。

必填字段：

* `params.radius: number`
* `params.pairId: string`

可选字段：

* `params.cooldownMs: number`
* `physics.isSensor: true`

约束：

* 同一 `pairId` 必须恰好出现 2 次。

### 5.5 `SLOT_JACKPOT`
用途：大奖槽。

必填字段：

* `params.width: number`
* `params.height: number`
* `params.rewardId: string`

可选字段：

* `params.multiplier: number`

### 5.6 `SLOT_DRAIN`
用途：普通落点槽、失败槽、回收槽。

必填字段：

* `params.width: number`
* `params.height: number`

可选字段：

* `params.drainMode: 'fail' | 'return' | 'score'`
* `params.rewardId: string`

### 5.7 `SPAWNER_EXTRA`
用途：额外球生成器。

必填字段：

* `params.spawnBallId: number`
* `params.spawnCount: number`
* `params.triggerId: string`

可选字段：

* `params.cooldownMs: number`

说明：

* `triggerId` 对应关卡中的某个触发条件或业务事件 ID。
* 生成器自身不是玩家主发射口，不替代 `launcher`。

### 5.8 `SPINNER_WINDMILL`
用途：风车、旋转十字。

必填字段：

* `params.armLength: number`
* `params.armCount: 2 | 3 | 4`

可选字段：

* `params.startAngle: number`
* `physics.density: number`

### 5.9 `PLATFORM_MOBILE`
用途：按路径往复运动的移动平台。

必填字段：

* `params.width: number`
* `params.height: number`
* `params.path: Array<{ x: number; y: number }>`
* `params.speed: number`

可选字段：

* `params.loop: boolean`
* `params.pingPong: boolean`

约束：

* `path` 至少 2 个点。

### 5.10 `SLOT_MACHINE_TRIGGER`
用途：老虎机触发区。

必填字段：

* `params.width: number`
* `params.height: number`
* `params.rewardTableId: string`

可选字段：

* `params.consumeBall: boolean`
* `physics.isSensor: true`

### 5.11 `Decoration`
用途：只负责视觉表现，不进入 Matter。

必填字段：

* `spriteId`
* `layer`

可选字段：

* `opacity`

## 6. Board 顶层编辑规范

### 6.1 `launcher`
编辑方式：

* 可在 `Board` 页签输入数值。
* 可在画布上直接拖动发射器锚点。

字段要求：

* `position` 必须位于 `environment.bounds` 内。
* `minForce < maxForce`。
* 默认发射方向必须与实际机台底部结构相容，不能直接朝外。

### 6.2 `environment`
字段要求：

* `bounds.width`、`bounds.height` 决定关卡工作区。
* `safeMargins` 用于运行时 UI 与物理边界安全区计算。
* `gravity` 决定 Matter 世界基础重力。

编辑器要求：

* 修改 `bounds` 后，画布、网格和 Safe Zone 立即重算。
* 修改 `safeMargins` 后，立即刷新边缘辅助框。

## 7. 模拟测试模式 (Play Test)

模拟测试是当前开发范围的一部分，不是附加项。

### 7.1 进入条件
* 当前关卡无阻塞级错误。
* 当前未处于未保存冲突状态。

### 7.2 功能范围
* 使用当前编辑结果构建临时 `BoardDefinitionV2`。
* 调用游戏运行时构建 Matter + Pixi 场景。
* 支持使用真实 `launcher` 参数发射球。
* 支持一键执行 `Drop Testing Probes`。

### 7.3 `Drop Testing Probes`
当前版本直接实现为：

* 输入测试球数量，默认 `100`。
* 从 `launcher.position` 以固定或随机扰动的力度区间投放。
* 对 `SLOT_DRAIN` 和 `SLOT_JACKPOT` 记录命中次数。
* 在槽位上以颜色深浅叠加热力结果。
* 允许将结果复制为文本摘要。

## 8. 校验、保存与导出

### 8.1 校验等级
* `Error`：阻止进入 Play Test 和 Export。
* `Warning`：允许导出，但必须在问题面板展示。
* `Info`：仅提示优化建议。

### 8.2 必做校验规则
* `boardId` 不能为空。
* `launcher` 必须存在。
* `environment` 必须存在。
* `entities` 不能为空。
* 至少存在一个 `SLOT_DRAIN` 或 `SLOT_JACKPOT` 作为底部落点。
* 所有实体 `id` 唯一。
* 所有实体必须位于 `bounds` 内，装饰允许越界但要给 `Warning`。
* `HOLE_WORMHOLE.pairId` 必须成对。
* `PLATFORM_MOBILE.path` 至少有两个点。
* `BLOCKER_GLASS` 多边形不得自相交。
* `SLOT_MACHINE_TRIGGER.rewardTableId` 不能为空。
* `SPAWNER_EXTRA.spawnCount` 必须大于 0。

### 8.3 保存与导出
* `Save`：保存编辑器工作文件，可包含 `editorMeta`。
* `Export JSON`：输出运行时关卡 JSON，默认保留 `editorMeta`，如运行时不消费可在构建阶段剥离。
* 导出文件命名默认与 `boardId` 对齐，例如 `board_001.json`。

## 9. 开发拆分建议

虽然这些功能都属于当前范围，但实现上必须按依赖顺序拆分。

### 阶段 A：Schema 与基础 UI 壳
* 顶部工具栏、左侧页签、中间画布、右侧 Inspector、底部状态栏。
* `BoardDefinitionV2` 类型与导入导出。
* `launcher` / `environment` 顶层编辑。

### 阶段 B：基础编辑能力
* `PIN_BASIC`、`BUMPER_ELASTIC`、`BLOCKER_GLASS`、`SLOT_DRAIN`、`SLOT_JACKPOT`。
* 选择、拖拽、旋转、复制、删除、撤销重做。
* JSON 导出和基础校验。

### 阶段 C：高级实体与批量工具
* `HOLE_WORMHOLE`、`SPAWNER_EXTRA`、`SPINNER_WINDMILL`、`PLATFORM_MOBILE`、`SLOT_MACHINE_TRIGGER`。
* 镜像、阵列、路径散布、多边形顶点编辑。

### 阶段 D：装饰层与模拟测试
* `Decoration` 支持。
* `Play Test` 和 `Drop Testing Probes`。
* 问题面板与热力结果叠加。

## 10. 验收标准

当以下条件全部满足时，编辑器视为达到首个可用版本：

* 可以新建一张机台，并编辑 `launcher`、`environment`。
* 可以放置、选择、删除、复制、镜像各种基础实体。
* 可以编辑自定义挡板顶点和移动平台路径。
* 可以配置弹珠落点槽、大奖槽、老虎机触发器、额外生成器、传送门。
* 可以保存、导入、导出 JSON。
* 可以执行校验并给出精确错误定位。
* 可以从当前编辑结果进入试玩并完成批量落点测试。