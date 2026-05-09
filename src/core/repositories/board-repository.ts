import board001Json from '../../../generated/boards/board_001.json';
import type { BoardDefinition, BoardDefinitionV2, BoardEntity, EditorMeta, Vector2 } from '../types/content.types';

const DEFAULT_EDITOR_META: EditorMeta = {
  guideVisible: true,
  lastCamera: { x: 0, y: 0 },
  lastZoom: 1,
  snapEnabled: true,
  snapSize: 24,
};

export type BoardValidationSeverity = 'error' | 'warning';

export interface BoardValidationIssue {
  code: string;
  severity: BoardValidationSeverity;
  message: string;
  field?: string;
  entityId?: string;
}

export interface BoardValidationResult {
  board: BoardDefinitionV2;
  isValid: boolean;
  issues: BoardValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export class BoardRepository {
  private readonly boards: Record<string, BoardDefinitionV2> = {
    board_001: normalizeBoardDefinition(board001Json as BoardDefinition),
  };

  async loadBoard(boardId: string): Promise<BoardDefinitionV2> {
    const board = this.boards[boardId];
    if (!board) {
      throw new Error(`Unknown board id ${boardId}.`);
    }

    const validation = this.validateBoard(board);
    if (!validation.isValid) {
      const summary = validation.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => issue.message)
        .join(' ');
      throw new Error(`Board ${boardId} failed validation. ${summary}`.trim());
    }

    return validation.board;
  }

  validateBoard(board: BoardDefinition): BoardValidationResult {
    const normalizedBoard = normalizeBoardDefinition(board);
    const issues: BoardValidationIssue[] = [];
    const seenEntityIds = new Set<string>();
    const seenDecorationIds = new Set<string>();
    const wormholePairs = new Map<string, number>();
    let slotCount = 0;

    if (board.version === 1) {
      issues.push(createIssue('warning', 'board-version-upgrade', 'Board version 1 is normalized to version 2 when loaded.', 'version'));
    }

    if (!normalizedBoard.boardId.trim()) {
      issues.push(createIssue('error', 'board-id-empty', 'boardId cannot be empty.', 'boardId'));
    }

    if (normalizedBoard.launcher.minForce >= normalizedBoard.launcher.maxForce) {
      issues.push(createIssue('error', 'launcher-force-range', 'launcher.minForce must be smaller than launcher.maxForce.', 'launcher'));
    }

    if (normalizedBoard.environment.bounds.width <= 0 || normalizedBoard.environment.bounds.height <= 0) {
      issues.push(createIssue('error', 'bounds-invalid', 'environment.bounds width and height must both be greater than zero.', 'environment.bounds'));
    }

    if (
      normalizedBoard.environment.safeMargins.left + normalizedBoard.environment.safeMargins.right >= normalizedBoard.environment.bounds.width ||
      normalizedBoard.environment.safeMargins.top + normalizedBoard.environment.safeMargins.bottom >= normalizedBoard.environment.bounds.height
    ) {
      issues.push(createIssue('error', 'safe-margins-invalid', 'Safe margins leave no playable area inside the board bounds.', 'environment.safeMargins'));
    }

    if (!isInsideRect(normalizedBoard.launcher.position, normalizedBoard.environment.bounds.width, normalizedBoard.environment.bounds.height)) {
      issues.push(createIssue('warning', 'launcher-outside-bounds', 'Launcher position is outside board bounds.', 'launcher.position'));
    }

    if (normalizedBoard.entities.length === 0) {
      issues.push(createIssue('error', 'entities-empty', 'Board does not contain any entities.', 'entities'));
    }

    for (const entity of normalizedBoard.entities) {
      if (seenEntityIds.has(entity.id)) {
        issues.push(createIssue('error', 'entity-id-duplicate', `Entity id ${entity.id} is duplicated.`, 'id', entity.id));
      }
      seenEntityIds.add(entity.id);

      if (!isInsideBounds(entity, normalizedBoard.environment.bounds.width, normalizedBoard.environment.bounds.height)) {
        issues.push(createIssue('warning', 'entity-outside-bounds', 'Entity is positioned outside board bounds.', 'transform', entity.id));
      }

      issues.push(...validateEntity(entity, wormholePairs, () => { slotCount += 1; }));
    }

    if (slotCount === 0) {
      issues.push(createIssue('error', 'slot-missing', 'Board must contain at least one SLOT_DRAIN or SLOT_JACKPOT.', 'entities'));
    }

    for (const [pairId, count] of wormholePairs.entries()) {
      if (count !== 2) {
        issues.push(createIssue('error', 'wormhole-pair-invalid', `Wormhole pair ${pairId} must appear exactly twice.`, 'entities'));
      }
    }

    for (const decoration of normalizedBoard.decorations ?? []) {
      if (seenDecorationIds.has(decoration.id)) {
        issues.push(createIssue('warning', 'decoration-id-duplicate', `Decoration id ${decoration.id} is duplicated.`, 'decorations', decoration.id));
      }
      seenDecorationIds.add(decoration.id);

      if (typeof decoration.opacity === 'number' && (decoration.opacity < 0 || decoration.opacity > 1)) {
        issues.push(createIssue('warning', 'decoration-opacity-range', `Decoration ${decoration.id} opacity should stay between 0 and 1.`, 'decorations', decoration.id));
      }
    }

    const errorCount = issues.filter((issue) => issue.severity === 'error').length;

    return {
      board: normalizedBoard,
      errorCount,
      isValid: errorCount === 0,
      issues,
      warningCount: issues.length - errorCount,
    };
  }
}

export const boardRepository = new BoardRepository();

function normalizeBoardDefinition(board: BoardDefinition): BoardDefinitionV2 {
  if (board.version === 2) {
    return {
      ...cloneBoardDefinition(board),
      decorations: board.decorations ?? [],
      editorMeta: {
        ...DEFAULT_EDITOR_META,
        ...board.editorMeta,
      },
    };
  }

  return {
    ...board,
    version: 2,
    decorations: [],
    editorMeta: { ...DEFAULT_EDITOR_META },
  };
}

function cloneBoardDefinition(board: BoardDefinitionV2): BoardDefinitionV2 {
  return JSON.parse(JSON.stringify(board)) as BoardDefinitionV2;
}

function validateEntity(
  entity: BoardEntity,
  wormholePairs: Map<string, number>,
  registerSlot: () => void,
): BoardValidationIssue[] {
  const issues: BoardValidationIssue[] = [];

  switch (entity.type) {
    case 'PIN_BASIC': {
      if (!isPositiveNumber(entity.params.radius)) {
        issues.push(createIssue('error', 'pin-radius-invalid', 'PIN_BASIC radius must be a positive number.', 'params.radius', entity.id));
      }
      break;
    }
    case 'BUMPER_ELASTIC': {
      if (!isPositiveNumber(entity.params.radius)) {
        issues.push(createIssue('error', 'bumper-radius-invalid', 'BUMPER_ELASTIC radius must be a positive number.', 'params.radius', entity.id));
      }
      if (!isPositiveNumber(entity.params.impulseMultiplier)) {
        issues.push(createIssue('error', 'bumper-impulse-invalid', 'BUMPER_ELASTIC impulseMultiplier must be a positive number.', 'params.impulseMultiplier', entity.id));
      }
      break;
    }
    case 'BLOCKER_GLASS': {
      const shape = readString(entity.params.shape);
      if (shape === 'rect') {
        if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
          issues.push(createIssue('error', 'blocker-rect-invalid', 'BLOCKER_GLASS rect shape requires positive width and height.', 'params', entity.id));
        }
      } else if (shape === 'polygon') {
        const vertices = readVector2Array(entity.params.vertices);
        if (!vertices || vertices.length < 3) {
          issues.push(createIssue('error', 'blocker-polygon-invalid', 'BLOCKER_GLASS polygon shape requires at least 3 vertices.', 'params.vertices', entity.id));
        } else if (hasSelfIntersection(vertices)) {
          issues.push(createIssue('error', 'blocker-polygon-self-intersection', 'BLOCKER_GLASS polygon vertices must not self-intersect.', 'params.vertices', entity.id));
        }
      } else {
        issues.push(createIssue('error', 'blocker-shape-invalid', 'BLOCKER_GLASS shape must be rect or polygon.', 'params.shape', entity.id));
      }
      break;
    }
    case 'HOLE_WORMHOLE': {
      const pairId = readString(entity.params.pairId);
      if (!isPositiveNumber(entity.params.radius)) {
        issues.push(createIssue('error', 'wormhole-radius-invalid', 'HOLE_WORMHOLE radius must be a positive number.', 'params.radius', entity.id));
      }
      if (!pairId) {
        issues.push(createIssue('error', 'wormhole-pair-missing', 'HOLE_WORMHOLE pairId cannot be empty.', 'params.pairId', entity.id));
      } else {
        wormholePairs.set(pairId, (wormholePairs.get(pairId) ?? 0) + 1);
      }
      break;
    }
    case 'SLOT_JACKPOT': {
      registerSlot();
      if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
        issues.push(createIssue('error', 'slot-jackpot-size-invalid', 'SLOT_JACKPOT requires positive width and height.', 'params', entity.id));
      }
      if (!readString(entity.params.rewardId)) {
        issues.push(createIssue('error', 'slot-jackpot-reward-missing', 'SLOT_JACKPOT rewardId cannot be empty.', 'params.rewardId', entity.id));
      }
      break;
    }
    case 'SLOT_DRAIN': {
      registerSlot();
      if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
        issues.push(createIssue('error', 'slot-drain-size-invalid', 'SLOT_DRAIN requires positive width and height.', 'params', entity.id));
      }
      break;
    }
    case 'SPAWNER_EXTRA': {
      if (!isPositiveNumber(entity.params.spawnBallId)) {
        issues.push(createIssue('error', 'spawner-ball-invalid', 'SPAWNER_EXTRA spawnBallId must be a positive number.', 'params.spawnBallId', entity.id));
      }
      if (!isPositiveNumber(entity.params.spawnCount)) {
        issues.push(createIssue('error', 'spawner-count-invalid', 'SPAWNER_EXTRA spawnCount must be greater than zero.', 'params.spawnCount', entity.id));
      }
      if (!readString(entity.params.triggerId)) {
        issues.push(createIssue('error', 'spawner-trigger-missing', 'SPAWNER_EXTRA triggerId cannot be empty.', 'params.triggerId', entity.id));
      }
      break;
    }
    case 'SPINNER_WINDMILL': {
      if (!isPositiveNumber(entity.params.armLength)) {
        issues.push(createIssue('error', 'spinner-arm-length-invalid', 'SPINNER_WINDMILL armLength must be a positive number.', 'params.armLength', entity.id));
      }
      const armCount = asNumber(entity.params.armCount);
      if (!armCount || ![2, 3, 4].includes(armCount)) {
        issues.push(createIssue('error', 'spinner-arm-count-invalid', 'SPINNER_WINDMILL armCount must be 2, 3, or 4.', 'params.armCount', entity.id));
      }
      break;
    }
    case 'PLATFORM_MOBILE': {
      if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
        issues.push(createIssue('error', 'platform-size-invalid', 'PLATFORM_MOBILE requires positive width and height.', 'params', entity.id));
      }
      const path = readVector2Array(entity.params.path);
      if (!path || path.length < 2) {
        issues.push(createIssue('error', 'platform-path-invalid', 'PLATFORM_MOBILE path requires at least two points.', 'params.path', entity.id));
      }
      if (!isPositiveNumber(entity.params.speed)) {
        issues.push(createIssue('error', 'platform-speed-invalid', 'PLATFORM_MOBILE speed must be a positive number.', 'params.speed', entity.id));
      }
      break;
    }
    case 'SLOT_MACHINE_TRIGGER': {
      if (!isPositiveNumber(entity.params.width) || !isPositiveNumber(entity.params.height)) {
        issues.push(createIssue('error', 'slot-machine-size-invalid', 'SLOT_MACHINE_TRIGGER requires positive width and height.', 'params', entity.id));
      }
      if (!readString(entity.params.rewardTableId)) {
        issues.push(createIssue('error', 'slot-machine-table-missing', 'SLOT_MACHINE_TRIGGER rewardTableId cannot be empty.', 'params.rewardTableId', entity.id));
      }
      break;
    }
  }

  return issues;
}

function createIssue(
  severity: BoardValidationSeverity,
  code: string,
  message: string,
  field?: string,
  entityId?: string,
): BoardValidationIssue {
  return {
    code,
    severity,
    message,
    field,
    entityId,
  };
}

function isInsideBounds(entity: BoardEntity, width: number, height: number): boolean {
  return isInsideRect(entity.transform, width, height);
}

function isInsideRect(point: Vector2, width: number, height: number): boolean {
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
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