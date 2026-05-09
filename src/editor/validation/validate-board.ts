import type { BoardDefinitionV2, BoardEntity, Vector2 } from '../../core/types/content.types';
import type { EditorProblem } from '../types/editor.types';

export function validateBoardDefinition(board: BoardDefinitionV2): EditorProblem[] {
  const problems: EditorProblem[] = [];
  const seenIds = new Set<string>();
  const wormholePairs = new Map<string, number>();
  let slotCount = 0;

  if (!board.boardId.trim()) {
    problems.push(createBoardProblem('board-id', 'error', 'boardId 不能为空。', 'boardId'));
  }

  if (board.launcher.minForce >= board.launcher.maxForce) {
    problems.push(createBoardProblem('launcher-force', 'error', 'launcher.minForce 必须小于 launcher.maxForce。', 'launcher'));
  }

  if (board.environment.bounds.width <= 0 || board.environment.bounds.height <= 0) {
    problems.push(createBoardProblem('bounds-size', 'error', 'environment.bounds 的宽高必须大于 0。', 'environment.bounds'));
  }

  if (board.entities.length === 0) {
    problems.push(createBoardProblem('entities-empty', 'error', '至少需要一个实体才能导出或试玩。', 'entities'));
  }

  for (const entity of board.entities) {
    if (seenIds.has(entity.id)) {
      problems.push(createEntityProblem(entity.id, 'error', `实体 ID ${entity.id} 重复。`, 'id'));
    }
    seenIds.add(entity.id);

    const inBounds = isInsideBounds(entity, board.environment.bounds.width, board.environment.bounds.height);
    if (!inBounds) {
      problems.push(createEntityProblem(entity.id, 'warning', '实体超出机台 bounds，运行时可能不可见或不可交互。', 'transform'));
    }

    switch (entity.type) {
      case 'PIN_BASIC': {
        if (!isPositiveNumber(entity.params.radius)) {
          problems.push(createEntityProblem(entity.id, 'error', 'PIN_BASIC.params.radius 必须为正数。', 'params.radius'));
        }
        break;
      }
      case 'BUMPER_ELASTIC': {
        if (!isPositiveNumber(entity.params.radius)) {
          problems.push(createEntityProblem(entity.id, 'error', 'BUMPER_ELASTIC.params.radius 必须为正数。', 'params.radius'));
        }
        if (!isPositiveNumber(entity.params.impulseMultiplier)) {
          problems.push(createEntityProblem(entity.id, 'error', 'BUMPER_ELASTIC.params.impulseMultiplier 必须为正数。', 'params.impulseMultiplier'));
        }
        break;
      }
      case 'BLOCKER_GLASS': {
        const shape = readString(entity.params.shape);
        if (shape === 'rect') {
          if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
            problems.push(createEntityProblem(entity.id, 'error', 'BLOCKER_GLASS 矩形挡板需要有效的 width / height。', 'params'));
          }
        } else if (shape === 'polygon') {
          const vertices = readVector2Array(entity.params.vertices);
          if (!vertices || vertices.length < 3) {
            problems.push(createEntityProblem(entity.id, 'error', 'BLOCKER_GLASS 多边形至少需要 3 个顶点。', 'params.vertices'));
          } else if (hasSelfIntersection(vertices)) {
            problems.push(createEntityProblem(entity.id, 'error', 'BLOCKER_GLASS 多边形顶点存在自相交。', 'params.vertices'));
          }
        } else {
          problems.push(createEntityProblem(entity.id, 'error', 'BLOCKER_GLASS.params.shape 必须为 rect 或 polygon。', 'params.shape'));
        }
        break;
      }
      case 'HOLE_WORMHOLE': {
        const pairId = readString(entity.params.pairId);
        if (!isPositiveNumber(entity.params.radius)) {
          problems.push(createEntityProblem(entity.id, 'error', 'HOLE_WORMHOLE.params.radius 必须为正数。', 'params.radius'));
        }
        if (!pairId) {
          problems.push(createEntityProblem(entity.id, 'error', 'HOLE_WORMHOLE.params.pairId 不能为空。', 'params.pairId'));
        } else {
          wormholePairs.set(pairId, (wormholePairs.get(pairId) ?? 0) + 1);
        }
        break;
      }
      case 'SLOT_JACKPOT': {
        slotCount += 1;
        if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SLOT_JACKPOT 需要有效的 width / height。', 'params'));
        }
        if (!readString(entity.params.rewardId)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SLOT_JACKPOT.params.rewardId 不能为空。', 'params.rewardId'));
        }
        break;
      }
      case 'SLOT_DRAIN': {
        slotCount += 1;
        if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SLOT_DRAIN 需要有效的 width / height。', 'params'));
        }
        break;
      }
      case 'SPAWNER_EXTRA': {
        if (!isPositiveNumber(entity.params.spawnBallId)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SPAWNER_EXTRA.params.spawnBallId 必须为正数。', 'params.spawnBallId'));
        }
        if (!isPositiveNumber(entity.params.spawnCount)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SPAWNER_EXTRA.params.spawnCount 必须大于 0。', 'params.spawnCount'));
        }
        if (!readString(entity.params.triggerId)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SPAWNER_EXTRA.params.triggerId 不能为空。', 'params.triggerId'));
        }
        break;
      }
      case 'SPINNER_WINDMILL': {
        if (!isPositiveNumber(entity.params.armLength)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SPINNER_WINDMILL.params.armLength 必须为正数。', 'params.armLength'));
        }
        const armCount = asNumber(entity.params.armCount);
        if (!armCount || ![2, 3, 4].includes(armCount)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SPINNER_WINDMILL.params.armCount 仅支持 2、3、4。', 'params.armCount'));
        }
        break;
      }
      case 'PLATFORM_MOBILE': {
        if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
          problems.push(createEntityProblem(entity.id, 'error', 'PLATFORM_MOBILE 需要有效的 width / height。', 'params'));
        }
        const path = readVector2Array(entity.params.path);
        if (!path || path.length < 2) {
          problems.push(createEntityProblem(entity.id, 'error', 'PLATFORM_MOBILE.params.path 至少需要 2 个点。', 'params.path'));
        }
        if (!isPositiveNumber(entity.params.speed)) {
          problems.push(createEntityProblem(entity.id, 'error', 'PLATFORM_MOBILE.params.speed 必须为正数。', 'params.speed'));
        }
        break;
      }
      case 'SLOT_MACHINE_TRIGGER': {
        if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SLOT_MACHINE_TRIGGER 需要有效的 width / height。', 'params'));
        }
        if (!readString(entity.params.rewardTableId)) {
          problems.push(createEntityProblem(entity.id, 'error', 'SLOT_MACHINE_TRIGGER.params.rewardTableId 不能为空。', 'params.rewardTableId'));
        }
        break;
      }
      default:
        break;
    }
  }

  if (slotCount === 0) {
    problems.push(createBoardProblem('slot-missing', 'error', '至少需要一个 SLOT_DRAIN 或 SLOT_JACKPOT 作为底部落点。', 'entities'));
  }

  for (const [pairId, count] of wormholePairs.entries()) {
    if (count !== 2) {
      problems.push(createBoardProblem(`wormhole-${pairId}`, 'error', `传送门 pairId=${pairId} 必须恰好成对出现 2 次。`, 'entities'));
    }
  }

  return problems;
}

function createBoardProblem(id: string, severity: EditorProblem['severity'], message: string, field?: string): EditorProblem {
  return {
    id,
    severity,
    message,
    target: {
      kind: 'board',
      field,
    },
  };
}

function createEntityProblem(id: string, severity: EditorProblem['severity'], message: string, field?: string): EditorProblem {
  return {
    id: `${id}:${field ?? 'entity'}`,
    severity,
    message,
    target: {
      kind: 'entity',
      id,
      field,
    },
  };
}

function isInsideBounds(entity: BoardEntity, width: number, height: number): boolean {
  return entity.transform.x >= 0 && entity.transform.x <= width && entity.transform.y >= 0 && entity.transform.y <= height;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readVector2Array(value: unknown): Vector2[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points = value.filter(isVector2);
  return points.length === value.length ? points : null;
}

function isVector2(value: unknown): value is Vector2 {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as Record<string, unknown>;
  return typeof point.x === 'number' && Number.isFinite(point.x) && typeof point.y === 'number' && Number.isFinite(point.y);
}

function hasSelfIntersection(vertices: Vector2[]): boolean {
  for (let index = 0; index < vertices.length; index += 1) {
    const startA = vertices[index];
    const endA = vertices[(index + 1) % vertices.length];

    for (let compareIndex = index + 1; compareIndex < vertices.length; compareIndex += 1) {
      if (Math.abs(index - compareIndex) <= 1) {
        continue;
      }

      if (index === 0 && compareIndex === vertices.length - 1) {
        continue;
      }

      const startB = vertices[compareIndex];
      const endB = vertices[(compareIndex + 1) % vertices.length];
      if (segmentsIntersect(startA, endA, startB, endB)) {
        return true;
      }
    }
  }

  return false;
}

function segmentsIntersect(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): boolean {
  const d1 = direction(a1, a2, b1);
  const d2 = direction(a1, a2, b2);
  const d3 = direction(b1, b2, a1);
  const d4 = direction(b1, b2, a2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function direction(a: Vector2, b: Vector2, point: Vector2): number {
  return (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
}
