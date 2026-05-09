# 数据结构与通信规范 (Data & API)

## 1. 当前阶段范围 (MVP Scope)
当前版本以**单人离线 Web MVP** 为目标，运行时仅消费构建产出的 JSON 数据，不依赖在线服务。

* **当前必须定义：** 关卡 JSON、配置 JSON、本地存档结构、编辑器导出契约。
* **当前不纳入交付：** 公开 UGC、排行榜、云存档、JWT 鉴权、回放防作弊、俱乐部等强服务端能力。

## 2. 运行时数据链路 (Runtime Data Pipeline)
* **策划源表：** 可在 Excel / 飞书中维护。
* **仓库版本化格式：** 统一提交为 CSV。
* **构建产物：** 构建脚本将 CSV 与关卡源数据转换为版本化 JSON。
* **客户端读取：** 游戏运行时仅加载 JSON，不直接读取原始 CSV。

## 3. 关卡数据模型 (Level JSON Schema)
关卡数据用于定义整张柏青哥台面的物理障碍构成、发射器信息与参数覆盖规则。每个关卡文件必须包含显式版本号，便于编辑器与运行时兼容。

### 3.1 顶层字段
* `version`: 关卡协议版本号，例如 `1`。
* `levelId`: 关卡唯一标识。
* `name`: 关卡名称。
* `backgroundId`: 关卡应用的美术背景 ID。
* `launcher`: 发射器配置。
  * `position`: 发射器坐标 `{ x, y }`。
  * `angle`: 发射器朝向。该值决定初始发射方向，玩家不会在局内连续调角。
  * `minForce` / `maxForce`: 力度映射区间。
* `environment`: 环境参数。
  * `gravity`: `{ x, y }` 方向的重力大小。
  * `bounds`: `{ width, height }` 有效物理边界。
  * `safeMargins`: 适配安全区与出界判定边距。

### 3.2 实体列表定义 (Entities Array)
每个实体由共享字段和类型专属字段两部分组成。

* **共享字段：**
  * `id`: 实例唯一标识（UUID 或稳定字符串）。
  * `type`: 组件枚举，例如 `PIN_BASIC`、`BUMPER_ELASTIC`、`BLOCKER_GLASS`。
  * `transform`: 包含 `x`, `y`, `scale`, `rotation` 坐标及缩放旋转信息。
  * `physics`: 记录 `friction`、`restitution`、`isStatic` 等物理参数。
  * `configRef`: 指向基础配置表中的 ID；运行时先加载配置默认值，再应用实体上的覆写字段。
  * `params`: 类型专属字段。

* **类型专属字段示例：**
  * `PIN_BASIC`: 无额外字段。
  * `BUMPER_ELASTIC`: `params = { bonusScore, impulseMultiplier }`。
  * `BLOCKER_GLASS`: `params = { maxHp, breakScore, revealPathId? }`。
  * `HOLE_WORMHOLE`: `params = { pairId, preserveSpeed: true }`。
  * `SLOT_JACKPOT`: `params = { rewardTableId, feverChargeBonus }`。
  * `SLOT_DRAIN`: `params = { killBall: true }`。

### 3.3 覆写规则 (Override Rules)
* 若实体声明 `configRef`，则先读取配置表默认值，再以实体上的 `physics` 与 `params` 覆写。
* 若实体未声明某个可选字段，则运行时回退到该类型的默认配置。
* 编辑器导出时必须补齐 `version`、`levelId`、`launcher` 与所有实体的 `type`。

### 3.4 Level JSON 示例
以下示例用于约束编辑器导出与运行时加载的最小可用格式：

```json
{
  "version": 1,
  "levelId": "level_001",
  "name": "新手试炼台",
  "backgroundId": "bg_arcade_starter",
  "launcher": {
    "position": { "x": 360, "y": 1040 },
    "angle": -90,
    "minForce": 8,
    "maxForce": 18
  },
  "environment": {
    "gravity": { "x": 0, "y": 9.81 },
    "bounds": { "width": 720, "height": 1280 },
    "safeMargins": { "top": 32, "right": 24, "bottom": 48, "left": 24 }
  },
  "entities": [
    {
      "id": "pin_001",
      "type": "PIN_BASIC",
      "configRef": 101,
      "transform": { "x": 240, "y": 320, "scale": 1, "rotation": 0 },
      "physics": { "friction": 0.05, "restitution": 0.4, "isStatic": true },
      "params": {}
    },
    {
      "id": "bumper_001",
      "type": "BUMPER_ELASTIC",
      "configRef": 102,
      "transform": { "x": 360, "y": 540, "scale": 1, "rotation": 0 },
      "physics": { "friction": 0.1, "restitution": 1.8, "isStatic": true },
      "params": { "bonusScore": 50, "impulseMultiplier": 1.2 }
    },
    {
      "id": "glass_001",
      "type": "BLOCKER_GLASS",
      "configRef": 103,
      "transform": { "x": 420, "y": 760, "scale": 1, "rotation": 15 },
      "physics": { "friction": 0.3, "restitution": 0.2, "isStatic": true },
      "params": { "maxHp": 3, "breakScore": 100 }
    },
    {
      "id": "jackpot_001",
      "type": "SLOT_JACKPOT",
      "configRef": 105,
      "transform": { "x": 360, "y": 1180, "scale": 1, "rotation": 0 },
      "physics": { "friction": 0.5, "restitution": 0.1, "isStatic": true },
      "params": { "rewardTableId": "starter_jackpot", "feverChargeBonus": 20 }
    }
  ]
}
```

### 3.5 编辑器导出要求
* 编辑器必须输出稳定且可读的字段顺序，便于版本管理审阅。
* 导出前校验 `levelId` 唯一性、`launcher` 完整性、`pairId` 配对完整性与 `configRef` 的存在性。
* 编辑器保存时允许保留额外的调试元数据，但导出到运行时 JSON 时必须剥离仅编辑器使用的字段。

## 4. 本地存档结构 (Local Save Contract)
MVP 仅定义本地存档，不定义服务端同步接口。

* `playerProfile`: 货币、体力、已解锁弹珠、局外成长。
* `settings`: 音量、画质、操作偏好。
* `runSnapshot`: 仅用于异常恢复或调试，不作为反作弊依据。

### 4.1 本地存档示例

```json
{
  "playerProfile": {
    "softCurrency": 1200,
    "energy": 40,
    "unlockedBalls": [1000, 1001, 1002],
    "talents": {
      "KINETIC_START": 2,
      "STARTING_FUNDS": 1
    }
  },
  "settings": {
    "masterVolume": 0.8,
    "effectsVolume": 0.9,
    "quality": "high",
    "holdSpaceToCharge": true
  },
  "runSnapshot": null
}
```

## 5. 在线接口规划 (Phase 2, Deferred)
以下能力在核心手感、单局闭环与内容生产稳定后再单独立项：

* 云存档与跨端同步。
* 排行榜与挑战赛接口。
* 公开 UGC 的上传、审核、下载与分享。
* 回放校验与服务端防作弊。