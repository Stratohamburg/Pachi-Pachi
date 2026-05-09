# UI 布局规范文档 (UI Layout Specification)

本文档详细说明了游戏前端页面的 DOM 结构、CSS 布局策略、响应式适配与层级（Z-Index）管理方案。针对“单人离线 Web MVP”进行定制。

## 1. 全局视口、基础容器与多端适配策略 (Viewport & Device Adaptation)

为了在全端提供类原生体验，系统核心采用基于**移动端优先 (Mobile First) 的定宽居中策略**，以此支持各种不同宽高比的设备：

- **9:16 标准手机竖屏：** 完美贴合，原生填满视口。
- **带鱼屏/超长比例手机 (如 20:9, 21:9)：** 依赖 `100dvh` 获得真实可见高度。这里**坚决不拉伸弹珠机界面**（保持物理机台的最大纵横比，例如被局限在 9:16 内并垂直居中或贴底贴顶排布）。屏幕上下方多余的空间将作为“安全功能区”，专用于放置 HUD 信息栏和底部弹射手柄，既利用了屏幕长度，又避免了UI覆盖遮挡物理盘面。配合 `safe-area-inset` 可完美避开刘海、挖孔和底部 Home 条。
- **桌面端横屏 (PC Desktop)：** 强制使用最大宽度（例如 `max-width: 500px` 或 `768px`）限制有效交互区，配合 `margin: 0 auto;` 保证核心界面在屏幕正中（类似于原生模拟器视角）。界面两侧的空白将显示全屏暗色护眼背景（或通过 Canvas 拓展模糊的场景底图）。

**基础 CSS 实现：**
- **全局静止：** `html`, `body`, `#root` 必须设置 `width: 100vw; height: 100vh;` 并 `overflow: hidden;`，完全禁止浏览器原生的弹性滚动与页面级反弹（Pull-to-refresh）。
- **全局容器：**
  ```css
  #root {
    display: flex;
    justify-content: center; /* 确保 PC 端横屏时，内容绝对居中 */
    background-color: var(--color-bg-base); /* 两侧留白区域的深色背景 */
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
  }
  .app-container {
    position: relative;
    width: 100%;
    max-width: 500px;      /* 推荐以手机宽度为上限，超长带鱼屏下也不会导致弹珠机变得过于宽胖 */
    height: 100%;
    /* margin: 0 auto 已经由 #root 里的 flex 实现居中 */
    overflow: hidden;      /* 页面内接管滚动 */
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5); /* 在 PC 横屏下制造边缘立体感 */
  }
  ```

## 2. 核心场景布局：战斗页 (BattlePage)

战斗页必须提供最完整的物理引擎沉浸感。结构上分为：底层全屏游戏画布 (PixiJS Canvas)、极小化表层数据面板 (HUD)、交互层 (Launcher & Overlays)。

**关键约束（来自设计反馈与开发纪要）：**
- **机台画布不拉伸：** 游戏内的柏青哥物理盘面存在逻辑比例上限（例如 9:16）。在带鱼屏下，Canvas 容器应使用 `object-contain` 或设定 `max-height`/`aspect-ratio` 保证物理世界**不被不合理拉长或形变挤压**。
- **信息最小化边缘化与空间利用：** 上方和侧面的状态信息（如分数、剩余弹珠）应当极小化处理。在普通屏幕悬浮于边缘；在带鱼屏下，它们则刚好填充并吸附在 Canvas 未覆盖的屏幕顶部/底部黑边区域即可，不遮挡主游玩区。
- Battle 页进入时给 `body` 加上 `.battle-active`，彻底锁死页面级滚动，事件直接由内部面板处理。
- 窄屏下**不要**给 Pixi 画布强行保底 480px 高；`BattleRuntime.updateViewport` 必须使用宿主容器的真实可用高度（100vh / 100dvh）与计算好的最大内容比例相配合。

### 2.1 结构层次 (Layering)

```html
<div class="battle-page (absolute inset-0 overflow-hidden flex flex-col items-center justify-center)">
  <!-- 1. 背景层 / 画布层 (不挤压拉伸，居中) -->
  <div id="battle-stage" class="absolute inset-0 z-0 flex items-center justify-center bg-black">
    <canvas id="pixi-canvas" class="w-full h-full max-h-[177vw] max-w-[56vh] object-contain aspect-[9/16]"></canvas>
  </div>
  
  <!-- 2. HUD 数据层 (绝对定位，悬浮或填充于顶部额外空间) -->
  <div class="battle-hud absolute top-0 left-0 w-full z-10 pointer-events-none p-2 flex justify-between text-xs opacity-80 pt-[env(safe-area-inset-top)]">
    <!-- 极小的分数与状态，吸附顶部 -->
    <div class="score-combo pointer-events-auto scale-75 origin-top-left">...</div>
    <div class="wave-info pointer-events-auto scale-75 origin-top-right">...</div>
  </div>

  <!-- 3. 战斗消息 / 临时飘字区 -->
  <div class="battle-message absolute inset-0 z-20 pointer-events-none flex-center">
    <!-- 必须绝对定位，跨越全屏防止被布局体系挤压 -->
  </div>

  <!-- 4. 操作层：右下竖向手柄 -->
  <!-- 吸附在右下角，如果是带鱼屏，这部分区域正好可能落在画布底部的空白区外围，或者略微重叠但仍有足够安全距离 -->
  <div class="battle-launcher absolute bottom-[max(5%,env(safe-area-inset-bottom))] right-[3%] z-30 pointer-events-auto h-[35%] w-[12%] max-w-[64px] opacity-90">
    <!-- 手柄推钮及刻度线 -->
  </div>

  <!-- 5. 弹层：三选一遗物 / 结算 / 暂停 -->
  <div class="battle-overlays absolute inset-0 z-40 bg-black/70 backdrop-blur-sm hidden">...</div>
</div>
```

## 3. 面板与功能页布局 (Panel & Pages Layout)

所有局外系统（大厅、抽卡、图鉴、天赋树）均采用移动端常见的 **TabBar 底部导航应用布局**。由于最大宽度限制在 `768px`，在 PC 端表现为两侧留白的竖屏比例设计。

### 3.1 主界面导航与大厅 (Main App Shell & Tab Navigation)

整个局外系统的默认入口是**带有底部导航栏的容器**，默认切页为“冒险”。

- **底部导航栏 (TabBar, 永远居于屏幕底部):** `display: flex; justify-content: space-around; align-items: center; height: 75px; z-index: 50;`
  - 导航项切页：`图鉴 (Gallery)` | `天赋 (Meta Tree)` | `冒险 (Adventure)` | `祈愿 (Gacha)` | `设置 (Settings)`。
  - **当前高亮态**根据所选页签动态变化，默认高亮为“冒险”。

- **内容区容器 (Content View):** `flex: 1; position: absolute; top: 0; bottom: 75px; width: 100%; overflow-y: auto;`
  - 不同的导航切页在此时进行组件挂载/卸载。

### 3.2 冒险菜单 (Default "Adventure" Tab)

系统开启时的默认主页，布局必须聚焦于“开始”操作。

- **Header (悬浮顶部):** `absolute top-0 left-0 w-full p-4`
  - 显示玩家名称/等级，以及最核心的货币、体力资源。
- **页面主体 (Center 居中):**
  - **核心视觉：** 页面中心区域为一个极其醒目的 `Start / 开始` 大按钮。
  - 按钮周边可以展示当前关卡进度/章节主题缩略图。
  - 整体空间应当留白，不堆砌其他入口，维持主界面的清爽与冒险感。
  - 使用 CSS Grid 卡片式布局展示系统入口：
  - `Play` 为大按钮 `grid-column: span 2; min-height: 120px;`。
  - `Gacha`、`Gallery`、`Meta Tree` 为次级方块。
- **Footer (高度: 70px):** 底部导航栏 / TabBar，固定在底部，方便单手触摸。

### 3.2 抽卡页 (GachaPage) & 图鉴页 (GalleryPage)

- **内容区滚动排版：**
  在图鉴页，采用两栏或左右抽屉布局。受限宽度时表现为：上方卡片列表（`display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));`），下方固定在底部的滑出式详情面板。

### 3.3 结算页 (ResultPage)

- **居中流式排版：**
  - **结构：** `display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;`
  - 胜利/失败标题采用大号美术字（Typography）。
  - 数据统计区占据中部核心视野，采用宽卡片 List 。
  - 底部操作按钮区域（重试 / 返回主页）置于 Safe Area 之上，间距至少 `16px`。

## 4. Z-Index 层级规范

为了避免弹出层被 Canvas 或其他悬浮组件遮挡，游戏全局规定了以下 `z-index` 区间：

| 层级名称       | Z-Index 值 | 说明                                                         |
| :------------- | :--------- | :----------------------------------------------------------- |
| `z-bg`         | -1         | 全局背景图、装饰底纹                                         |
| `z-canvas`     | 0          | PixiJS / Matter.js 主渲染画布                                |
| `z-hud`        | 10         | 局内记分板、状态栏、局外基础页面 DOM 元素                    |
| `z-message`    | 20         | 战斗提示飘字（如 Wave Complete, Fever Time），不阻挡交互     |
| `z-launcher`   | 30         | 战斗控制手柄、全局侧边悬浮组件（需要高于消息避免被误挡点击） |
| `z-popup`      | 40         | 页面级弹窗（遗物三选一、暂停菜单、抽卡展示）带模糊遮罩       |
| `z-toast`      | 50         | 全局浮动提示（错误网络提示、保存失败等）                     |
| `z-transition` | 100        | 页面切换全屏转场动画遮罩（如黑屏淡入淡出、闪白）             |

## 5. CSS / 样式选型与命名准则

- 推荐使用 Tailwind CSS 范式进行原子化类名管理（如果在项目中启用了 Tailwind），或者遵循 BEM 命名法（如不用 Tailwind）。
- **设备安全区 (Safe Area)：** 针对 iOS 设备，必须在底部与顶部适配安全距离：
  ```css
  .safe-area-top { padding-top: env(safe-area-inset-top, 20px); }
  .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 20px); }
  ```
- **字体与排版：** 数字（尤其是分数、组合数）强制使用等宽数字字体变体以保证在快速滚动时不会抖动：
  ```css
  .font-numeric {
    font-variant-numeric: tabular-nums;
  }
  ```
