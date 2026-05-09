# 编辑器前端实现任务清单 (Editor Frontend Implementation Tasks)

本文档把 [Editor_Design.md](./Editor_Design.md) 的设计规格拆成可执行的前端开发任务。目标不是写泛泛的 Roadmap，而是为当前仓库直接提供实现顺序、模块边界和验收点。

## 1. 交付目标

第一版编辑器需要同时满足以下条件：

* 能创建、导入、保存、导出关卡。
* 能编辑顶层 `launcher` 和 `environment`。
* 能放置和编辑基础实体与高级实体。
* 能执行校验并列出问题。
* 能进入模拟测试模式并执行批量落点测试。

## 2. 建议目录结构

建议在 `src/` 下新增独立编辑器入口，避免把生产力工具代码塞进现有战斗页与大厅页中。

```text
src/
  editor/
    app/
      editor-app.tsx
      editor-shell.tsx
    components/
      top-toolbar.tsx
      left-panel.tsx
      board-tab.tsx
      palette-tab.tsx
      outline-tab.tsx
      canvas-stage.tsx
      inspector-panel.tsx
      problem-panel.tsx
      status-bar.tsx
    stores/
      editor-store.ts
      history-store.ts
      validation-store.ts
    hooks/
      use-canvas-camera.ts
      use-selection.ts
      use-shortcuts.ts
      use-playtest.ts
    serializers/
      board-import.ts
      board-export.ts
      board-upgrade.ts
    validation/
      validate-board.ts
      validate-entities.ts
    types/
      editor.types.ts
    utils/
      ids.ts
      geometry.ts
      path-tools.ts
```

## 3. 阶段 A：数据层与编辑器壳

### A1. 建立编辑器入口
任务：

* 新增编辑器入口组件 `editor-app.tsx`。
* 提供独立的布局壳 `editor-shell.tsx`。
* 完成顶部工具栏、左侧面板、中间画布、右侧 Inspector、底部状态栏的布局占位。

验收：

* 页面能完整渲染五区布局。
* 布局尺寸调整时不塌陷。

### A2. 建立编辑器状态仓库
任务：

* 创建 `editor-store.ts` 管理当前 board、选中对象、当前模式、缩放、相机、脏状态。
* 创建 `history-store.ts` 管理 undo/redo。
* 创建 `validation-store.ts` 管理问题列表和当前校验结果。

验收：

* 可以切换编辑模式。
* 可以记录和恢复历史快照。

### A3. 建立导入导出与版本升级
任务：

* `board-import.ts`：导入 JSON 并转为编辑器内部状态。
* `board-upgrade.ts`：兼容旧版 `version: 1` 关卡，升级为当前编辑器工作结构。
* `board-export.ts`：从编辑器状态导出为 `BoardDefinitionV2`。

验收：

* 当前 [generated/boards/board_001.json](../../generated/boards/board_001.json) 可被导入。
* 导出结构包含 `launcher`、`environment`、`entities`，并按需带 `decorations`、`editorMeta`。

## 4. 阶段 B：Board 顶层编辑

### B1. `Board` 页签
任务：

* 实现 `boardId`、`levelId`、`name`、`backgroundId` 表单。
* 实现 `launcher` 表单。
* 实现 `environment` 表单。

验收：

* 修改任意字段会立即刷新中央画布。
* `bounds` 改变时，机台范围与安全区辅助线同步更新。

### B2. 发射器画布手柄
任务：

* 在 `canvas-stage.tsx` 显示 launcher 锚点。
* 支持拖拽 launcher 的位置。
* 支持显示发射方向角度。

验收：

* 拖拽 launcher 后，Inspector 数值同步变化。

## 5. 阶段 C：基础实体编辑

### C1. Palette 基础元件
任务：

* 接入 `PIN_BASIC`、`BUMPER_ELASTIC`、`BLOCKER_GLASS`、`SLOT_DRAIN`、`SLOT_JACKPOT` 的放置按钮。
* 支持点击放置和拖拽放置。

验收：

* 新建对象后自动分配唯一 ID。
* 新对象会出现在 `Outline` 和画布中。

### C2. 选择与基础变换
任务：

* 实现单选、多选、框选。
* 实现拖拽移动、旋转、删除、复制。
* 实现快捷键：Delete、Ctrl+D、F、Space+Drag。

验收：

* 多选对象可以整体移动。
* Undo/Redo 能恢复位置变化。

### C3. Inspector 基础表单
任务：

* 实现 `Identity`、`Transform`、`Physics`、`Params` 四个区域。
* 根据对象类型切换字段表单。

验收：

* 修改 `radius`、`width`、`height`、`rotation` 后画布立即刷新。

## 6. 阶段 D：高级实体编辑

### D1. 传送门与额外生成器
任务：

* 接入 `HOLE_WORMHOLE` 和 `SPAWNER_EXTRA`。
* Inspector 支持编辑 `pairId`、`spawnBallId`、`spawnCount`、`triggerId`。
* 画布上同 `pairId` 的传送门需要联动高亮。

验收：

* `pairId` 错配时校验器给出错误。

### D2. 风车与移动平台
任务：

* 接入 `SPINNER_WINDMILL`、`PLATFORM_MOBILE`。
* 移动平台支持路径点编辑。
* 风车支持臂长、臂数和起始角度编辑。

验收：

* 路径点至少两个，不满足时有错误提示。

### D3. 老虎机触发区
任务：

* 接入 `SLOT_MACHINE_TRIGGER`。
* Inspector 支持编辑 `rewardTableId` 和 `consumeBall`。
* 画布上以半透明触发框显示。

验收：

* 缺失 `rewardTableId` 时不允许导出。

## 7. 阶段 E：多边形挡板与批量工具

### E1. 多边形挡板顶点编辑
任务：

* `BLOCKER_GLASS` 支持 `shape = 'polygon'`。
* 增加 `Vertex Edit` 模式。
* 支持新增顶点、删除顶点、拖拽顶点。

验收：

* 非法自相交多边形会触发校验错误。

### E2. Mirror / Array / Path Distribution
任务：

* 实现左右镜像。
* 实现阵列复制。
* 实现沿路径散布钉子。

验收：

* 可以用同一工具批量生成大规模钉子阵列。

## 8. 阶段 F：装饰层与 Outline

### F1. Decoration 支持
任务：

* 支持新增 `Decoration`。
* 支持编辑 `spriteId`、`layer`、`opacity`。
* 画布区按 layer 分层绘制。

验收：

* Decorations 不参与碰撞，仅参与显示。

### F2. Outline 页签
任务：

* 显示 `Launcher`、`Environment`、`Entities`、`Decorations` 树。
* 支持搜索、筛选、锁定、隐藏、聚焦。

验收：

* 点击树节点可定位到对应对象。

## 9. 阶段 G：校验与问题面板

### G1. 校验器
任务：

* 实现 Board 基础校验。
* 实现实体参数校验。
* 实现几何校验和配对校验。

最低规则：

* `boardId` 非空。
* `launcher`、`environment`、`entities` 存在。
* 至少一个底部槽位存在。
* 实体 ID 唯一。
* 传送门成对。
* 多边形不自相交。
* 移动平台路径至少两个点。

### G2. Problems 面板
任务：

* 展示 `Error`、`Warning`、`Info`。
* 点击问题条目后聚焦对象或字段。

验收：

* 导出失败时，Problems 自动展开并选中第一条错误。

## 10. 阶段 H：Play Test 与落点测试

### H1. 试玩桥接
任务：

* 基于当前编辑状态构造临时 board。
* 接入现有运行时进行试玩。

验收：

* 编辑器内可以直接启动当前关卡试玩。

### H2. `Drop Testing Probes`
任务：

* 支持输入测试球数量。
* 支持批量发球。
* 支持统计 `SLOT_DRAIN` 和 `SLOT_JACKPOT` 命中次数。
* 支持热力叠加与结果摘要输出。

验收：

* 可以用 100 球测试快速比较不同盘面的落点分布。

## 11. 建议开发顺序

严格按以下顺序推进，避免先做复杂 UI 再回头补底层数据：

1. A：数据层、导入导出、编辑器壳。
2. B：Board 顶层编辑。
3. C：基础实体与基础 Inspector。
4. G：先做基础校验，再继续高级实体。
5. D：高级实体。
6. E：批量工具与多边形编辑。
7. F：装饰层与 Outline 增强。
8. H：试玩与落点测试。

## 12. 完成定义

只有当以下条件都成立，才算编辑器前端第一版完成：

* 关卡可导入、可编辑、可导出。
* 顶层 Board 配置与实体配置都可通过 UI 修改。
* 基础与高级实体均能可视化编辑。
* 校验错误能够阻止导出并提供定位。
* 编辑器内可直接启动试玩。
* 可以执行批量落点测试并得到可读结果。