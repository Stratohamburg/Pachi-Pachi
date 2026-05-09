import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configDir = path.join(rootDir, 'configs');
const generatedDir = path.join(rootDir, 'generated');

const requiredHeaders = {
  balls: ['Ball_ID', 'Name', 'Rarity', 'Mass', 'Bounciness', 'Radius', 'Skill_ID', 'Desc'],
  relics: ['Relic_ID', 'Title', 'Tier', 'Weight', 'Buff_Type', 'Buff_Value', 'Synergy_Tag', 'Desc'],
  obstacles: ['Obs_ID', 'Obs_Type', 'Score_Base', 'Friction', 'Restitution', 'Max_HP', 'Desc'],
  constants: ['Key', 'Value', 'Type', 'Desc'],
};

async function main() {
  const [ballsRows, relicRows, obstacleRows, constantRows] = await Promise.all([
    readCsv('Balls_Config.csv', requiredHeaders.balls),
    readCsv('Relics_Config.csv', requiredHeaders.relics),
    readCsv('Obstacles_Config.csv', requiredHeaders.obstacles),
    readCsv('Global_Constants.csv', requiredHeaders.constants),
  ]);

  const balls = indexById(ballsRows.map(parseBallRow), 'ball');
  const relics = indexById(relicRows.map(parseRelicRow), 'relic');
  const obstacles = indexById(obstacleRows.map(parseObstacleRow), 'obstacle');
  const constants = parseConstantRows(constantRows);
  const board = createStarterBoard(constants);
  const waves = createWaveSequence();

  await Promise.all([
    writeJson(path.join(generatedDir, 'config', 'balls.json'), balls),
    writeJson(path.join(generatedDir, 'config', 'relics.json'), relics),
    writeJson(path.join(generatedDir, 'config', 'obstacles.json'), obstacles),
    writeJson(path.join(generatedDir, 'config', 'global_constants.json'), constants),
    writeJson(path.join(generatedDir, 'boards', 'board_001.json'), board),
    writeJson(path.join(generatedDir, 'waves', 'wave_sequence.json'), waves),
  ]);

  console.log(`Built ${Object.keys(balls).length} balls, ${Object.keys(relics).length} relics, ${Object.keys(obstacles).length} obstacles.`);
}

async function readCsv(fileName, headers) {
  const filePath = path.join(configDir, fileName);
  const raw = await readFile(filePath, 'utf8');
  const rows = parseCsv(raw);
  const actualHeaders = rows.shift();

  if (!actualHeaders) {
    throw new Error(`${fileName} is empty.`);
  }

  for (const header of headers) {
    if (!actualHeaders.includes(header)) {
      throw new Error(`${fileName} is missing required header ${header}.`);
    }
  }

  return rows
    .filter((columns) => columns.some((column) => column.trim().length > 0))
    .map((columns, index) => {
      if (columns.length !== actualHeaders.length) {
        throw new Error(`${fileName} row ${index + 2} has ${columns.length} columns, expected ${actualHeaders.length}.`);
      }

      return Object.fromEntries(actualHeaders.map((header, headerIndex) => [header, columns[headerIndex].trim()]));
    });
}

function parseCsv(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function parseBallRow(row) {
  return {
    id: parseInteger(row.Ball_ID, 'Ball_ID'),
    name: row.Name,
    rarity: parseInteger(row.Rarity, 'Rarity'),
    mass: parseFloatValue(row.Mass, 'Mass'),
    bounciness: parseFloatValue(row.Bounciness, 'Bounciness'),
    radius: parseFloatValue(row.Radius, 'Radius'),
    skillId: parseInteger(row.Skill_ID, 'Skill_ID'),
    desc: row.Desc,
  };
}

function parseRelicRow(row) {
  return {
    id: parseInteger(row.Relic_ID, 'Relic_ID'),
    title: row.Title,
    tier: parseInteger(row.Tier, 'Tier'),
    weight: parseInteger(row.Weight, 'Weight'),
    buffType: row.Buff_Type,
    buffValue: parseJsonArray(row.Buff_Value, 'Buff_Value'),
    synergyTag: parseInteger(row.Synergy_Tag, 'Synergy_Tag'),
    desc: row.Desc,
  };
}

function parseObstacleRow(row) {
  return {
    id: parseInteger(row.Obs_ID, 'Obs_ID'),
    type: row.Obs_Type,
    scoreBase: parseInteger(row.Score_Base, 'Score_Base'),
    friction: parseFloatValue(row.Friction, 'Friction'),
    restitution: parseFloatValue(row.Restitution, 'Restitution'),
    maxHp: parseInteger(row.Max_HP, 'Max_HP'),
    desc: row.Desc,
  };
}

function parseConstantRows(rows) {
  const constants = {};

  for (const row of rows) {
    if (row.Key in constants) {
      throw new Error(`Duplicate global constant key ${row.Key}.`);
    }

    constants[row.Key] = {
      value: parseTypedValue(row.Value, row.Type, row.Key),
      type: row.Type,
      desc: row.Desc,
    };
  }

  return constants;
}

function parseTypedValue(value, type, key) {
  switch (type) {
    case 'INT':
      return parseInteger(value, key);
    case 'FLOAT':
      return parseFloatValue(value, key);
    case 'BOOLEAN':
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      throw new Error(`Expected BOOLEAN for ${key}, received ${value}.`);
    case 'STRING':
      return value;
    default:
      throw new Error(`Unsupported constant type ${type} for ${key}.`);
  }
}

function parseJsonArray(value, key) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('Not an array.');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse ${key} as JSON array: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseInteger(value, key) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected integer for ${key}, received ${value}.`);
  }
  return parsed;
}

function parseFloatValue(value, key) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected number for ${key}, received ${value}.`);
  }
  return parsed;
}

function indexById(items, label) {
  const indexed = {};

  for (const item of items) {
    const key = String(item.id);
    if (key in indexed) {
      throw new Error(`Duplicate ${label} id ${key}.`);
    }
    indexed[key] = item;
  }

  return indexed;
}

function createStarterBoard(constants) {
  const gravity = constants.BASE_GRAVITY_Y?.value;
  if (typeof gravity !== 'number') {
    throw new Error('BASE_GRAVITY_Y is required to build the starter board.');
  }

  return {
    version: 1,
    boardId: 'board_001',
    levelId: 'board_001',
    name: '新手试炼台',
    backgroundId: 'bg_arcade_starter',
    launcher: {
      position: { x: 360, y: 1110 },
      angle: -92,
      minForce: 0.016,
      maxForce: 0.034,
    },
    environment: {
      gravity: { x: 0, y: gravity },
      bounds: { width: 720, height: 1280 },
      safeMargins: { top: 32, right: 24, bottom: 48, left: 24 },
    },
    entities: [
      ...createPinField(),
      {
        id: 'bumper_center',
        type: 'BUMPER_ELASTIC',
        configRef: 102,
        transform: { x: 360, y: 620, scale: 1.2, rotation: 0 },
        physics: { friction: 0.1, restitution: 1.8, isStatic: true },
        params: { bonusScore: 75, impulseMultiplier: 1.18, radius: 24 },
      },
      {
        id: 'glass_left',
        type: 'BLOCKER_GLASS',
        configRef: 103,
        transform: { x: 255, y: 870, scale: 1, rotation: -20 },
        physics: { friction: 0.3, restitution: 0.2, isStatic: true },
        params: { shape: 'rect', maxHp: 3, breakScore: 160, width: 124, height: 18 },
      },
      {
        id: 'glass_right',
        type: 'BLOCKER_GLASS',
        configRef: 103,
        transform: { x: 465, y: 870, scale: 1, rotation: 20 },
        physics: { friction: 0.3, restitution: 0.2, isStatic: true },
        params: { shape: 'rect', maxHp: 3, breakScore: 160, width: 124, height: 18 },
      },
      {
        id: 'jackpot_slot',
        type: 'SLOT_JACKPOT',
        configRef: 105,
        transform: { x: 360, y: 1160, scale: 1, rotation: 0 },
        physics: { friction: 0.5, restitution: 0.1, isStatic: true },
        params: { rewardId: 'starter_jackpot', feverChargeBonus: 18, width: 124, height: 52 },
      },
      {
        id: 'drain_left',
        type: 'SLOT_DRAIN',
        configRef: 106,
        transform: { x: 110, y: 1160, scale: 1, rotation: 0 },
        physics: { friction: 0.5, restitution: 0.1, isStatic: true },
        params: { killBall: true, width: 120, height: 50 },
      },
      {
        id: 'drain_right',
        type: 'SLOT_DRAIN',
        configRef: 106,
        transform: { x: 610, y: 1160, scale: 1, rotation: 0 },
        physics: { friction: 0.5, restitution: 0.1, isStatic: true },
        params: { killBall: true, width: 120, height: 50 },
      },
    ],
  };
}

function createPinField() {
  const rows = [
    { y: 250, count: 6, offset: 0 },
    { y: 360, count: 5, offset: 55 },
    { y: 470, count: 6, offset: 0 },
    { y: 720, count: 5, offset: 55 },
  ];

  return rows.flatMap((row, rowIndex) => {
    const spacing = 90;
    const startX = 135 + row.offset;
    return Array.from({ length: row.count }, (_, columnIndex) => ({
      id: `pin_${rowIndex + 1}_${columnIndex + 1}`,
      type: 'PIN_BASIC',
      configRef: 101,
      transform: { x: startX + columnIndex * spacing, y: row.y, scale: 1, rotation: 0 },
      physics: { friction: 0.05, restitution: 0.4, isStatic: true },
      params: { radius: 14 },
    }));
  });
}

function createWaveSequence() {
  return [
    {
      waveIndex: 1,
      targetScore: 800,
      ballsProvided: 3,
      rewardOptions: 3,
      boardId: 'board_001',
    },
    {
      waveIndex: 2,
      targetScore: 1400,
      ballsProvided: 3,
      rewardOptions: 3,
      boardId: 'board_001',
    },
    {
      waveIndex: 3,
      targetScore: 2100,
      ballsProvided: 4,
      rewardOptions: 3,
      boardId: 'board_001',
    },
  ];
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});