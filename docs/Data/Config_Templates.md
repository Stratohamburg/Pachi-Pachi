# 数值与配置表设计模板 (Config Templates)

本项目的数据配置允许由策划在 Excel 或飞书中维护，但进入仓库时统一提交为 CSV；构建阶段再将 CSV 转换为 JSON 供程序读取。客户端运行时**只读取 JSON**，不直接读取原始 CSV。以下为核心表的字段设计方案。

## 1. 英雄弹珠配置表 (`Balls_Config.csv` -> `balls.json`)
用于定义抽卡获得的“球”的不同物理属性与被动机制。

| 字段名 (Key) | 数据类型 | 描述说明 | 示例值 |
| :--- | :--- | :--- | :--- |
| `Ball_ID` | INT | 全局唯一ID | 1001 |
| `Name` | STRING | 弹珠名称 | “狂战士铅球” |
| `Rarity` | INT | 稀有度(1-普通, 3-传说) | 3 |
| `Mass` | FLOAT | 物理质量(影响下落速度和相撞动能) | 5.5 |
| `Bounciness` | FLOAT | 物理反弹系数(0~1之间) | 0.1 |
| `Radius` | FLOAT | 碰撞体积半径(相对于标准1.0) | 1.2 |
| `Skill_ID` | INT | 羁绊或被动技能ID索引 | 205 (对应无视碎玻璃被动) |
| `Desc` | STRING | 图鉴中展示的描述文本 | “沉重且粗暴，碾碎一切阻碍！” |

## 2. 肉鸽遗物配置表 (`Relics_Config.csv` -> `relics.json`)
用于局内“三选一”或者商店售卖的增益卡池。

| 字段名 (Key) | 数据类型 | 描述说明 | 示例值 |
| :--- | :--- | :--- | :--- |
| `Relic_ID` | INT | 遗物唯一ID | 3012 |
| `Title` | STRING | 遗物卡牌标题 | “动能过载” |
| `Tier` | INT | 品质等级(影响卡牌框色与出现概率) | 2 |
| `Weight` | INT | 随机池权重(越大越容易随到) | 500 |
| `Buff_Type` | STRING | 程序硬编码拦截的逻辑枚举词 | `BUFF_SCORE_MULTIPLIER` |
| `Buff_Value` | ARRAY | 赋予的具体数值/数组，CSV 中以 JSON 字符串存储 | `[1.5]` |
| `Synergy_Tag` | INT | 标签联动(配合特定流派提高出现率) | 4 (动能系) |

## 3. 物理材质与机关表 (`Obstacles_Config.csv` -> `obstacles.json`)
关卡编辑器中所选用物件的基础物理底表。如果策划在编辑器里没有覆盖重写，将读此表默认值。

| 字段名 (Key) | 数据类型 | 描述说明 | 示例值 |
| :--- | :--- | :--- | :--- |
| `Obs_ID` | INT | 障碍种类ID | 102 |
| `Obs_Type` | STRING | 障碍逻辑类型 | `BUMPER_ELASTIC` (高弹柱) |
| `Score_Base` | INT | 发生单次碰撞给予的基础分数 | 50 |
| `Friction` | FLOAT | 表面摩擦力 | 0.05 |
| `Restitution` | FLOAT | 反弹力补偿加成 | 1.8 |
| `Max_HP` | INT | 耐久度(负数代表不可破坏) | -1 |

## 4. 全局数值常数表 (`Global_Constants.csv` -> `global_constants.json`)
以 Key-Value 的形式存储游戏中不常变动的宏观数字。
* `MAX_ENERGY` = 50 (最高体力上限)
* `FEVER_HIT_COUNT` = 80 (单球有效碰撞累计达到该阈值时触发狂热；大奖槽等高价值事件可折算为额外充能)
* `PERFECT_LAUNCH_TOLERANCE` = 0.05 (完美发射的力度区间容错值)

## 5. 构建与校验约定
* CSV 是仓库中的版本化来源，JSON 是运行时消费的产物。
* 所有 `*_ID` 字段必须保持稳定，不得在已上线内容中复用旧 ID。
* `ARRAY` 字段在 CSV 中统一采用 JSON 字符串表示，构建阶段负责解析与校验。
* 编辑器导出的关卡 JSON 若引用 `Obs_ID` 等配置字段，运行时遵循“默认配置 + 实体覆写”的合并规则。

## 6. 配置构建约定 (Build Contract)
为避免“表格能配、程序不能读”的断层，配置构建流程必须遵循以下约定：

### 6.1 输入与输出
* 输入目录：`configs/*.csv`
* 输出目录：`generated/config/*.json`
* 输出文件名与来源表一一对应，例如 `Balls_Config.csv -> generated/config/balls.json`

### 6.2 构建阶段必须完成的事情
* 读取 CSV 表头并校验是否存在必填列。
* 将 `INT`、`FLOAT`、`ARRAY` 等字段解析为正确的 JSON 类型。
* 校验主键唯一性、引用完整性和枚举合法性。
* 为遗漏的可选字段补齐默认值。
* 生成可供客户端直接加载的扁平 JSON 或按 ID 建索引的 JSON。

### 6.3 推荐输出格式
为减少运行时查找成本，建议输出按 ID 建索引的对象结构：

```json
{
	"1001": {
		"id": 1001,
		"name": "狂战士铅球",
		"rarity": 3,
		"mass": 5.5,
		"bounciness": 0.1,
		"radius": 1.2,
		"skillId": 205,
		"desc": "沉重且粗暴，碾碎一切阻碍！"
	}
}
```

### 6.4 失败策略
* 若发现重复 ID、非法枚举或数组解析失败，构建必须直接失败。
* 若仅缺失可选字段，可由构建器填充默认值并输出警告。
* 任何会影响平衡性的隐式回退都必须在构建日志中明确记录。