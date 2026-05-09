import { create } from 'zustand';
import board001Json from '../../../generated/boards/board_001.json';
import type {
  BoardEntity,
  BoardDefinition,
  BoardDefinitionV2,
  EntityType,
  EnvironmentDefinition,
  LauncherDefinition,
  TransformData,
  Vector2,
} from '../../core/types/content.types';
import { exportBoardToJson } from '../serializers/board-export';
import { importBoardFromJson } from '../serializers/board-import';
import { cloneBoardDefinition, createEmptyBoardDefinition, upgradeBoardDefinition } from '../serializers/board-upgrade';
import type { EditorCamera, EditorMode, EditorPanelTab, EditorProblem, EditorSelection } from '../types/editor.types';
import { validateBoardDefinition } from '../validation/validate-board';

const DRAFT_STORAGE_KEY = 'pachinko.editor.draft.v1';
const sampleBoard = upgradeBoardDefinition(board001Json as BoardDefinition);

type BoardMetaField = 'backgroundId' | 'boardId' | 'levelId' | 'name';
type GravityField = keyof EnvironmentDefinition['gravity'];
type LocalBoundsField = keyof EnvironmentDefinition['bounds'];
type LocalSafeMarginField = keyof EnvironmentDefinition['safeMargins'];
type LauncherField = keyof LauncherDefinition;
type EntityTransformField = keyof TransformData;
type EntitySelectionOptions = { additive?: boolean; toggle?: boolean };
type EntityPositionUpdate = { id: string; position: Vector2 };

interface EditorStoreState {
  initialized: boolean;
  board: BoardDefinitionV2;
  mode: EditorMode;
  activeTab: EditorPanelTab;
  selection: EditorSelection;
  selectedEntityIds: string[];
  placementType: EntityType | null;
  continuousPlacement: boolean;
  camera: EditorCamera;
  dirty: boolean;
  lastSavedAt: number | null;
  notice: string | null;
  problems: EditorProblem[];
  initialize: () => void;
  clearNotice: () => void;
  setMode: (mode: EditorMode) => void;
  setActiveTab: (tab: EditorPanelTab) => void;
  setCamera: (camera: Partial<EditorCamera>) => void;
  setContinuousPlacement: (enabled: boolean) => void;
  beginPlaceEntity: (type: EntityType) => void;
  cancelPlacement: () => void;
  selectBoard: () => void;
  selectEntity: (id: string, options?: EntitySelectionOptions) => void;
  selectEntities: (ids: string[], options?: { additive?: boolean }) => void;
  selectDecoration: (id: string) => void;
  placeEntityAt: (position: Vector2) => void;
  moveEntityTo: (id: string, position: Vector2) => void;
  moveEntitiesTo: (updates: EntityPositionUpdate[]) => void;
  resetBoard: () => void;
  loadSampleBoard: () => void;
  importBoardFromText: (text: string) => void;
  saveDraft: () => void;
  exportBoardJson: () => string | null;
  validate: () => EditorProblem[];
  updateBoardMeta: (field: BoardMetaField, value: string) => void;
  updateLauncherField: (field: LauncherField, value: number | LauncherDefinition['position']) => void;
  updateGravityField: (field: GravityField, value: number) => void;
  updateBoundsField: (field: LocalBoundsField, value: number) => void;
  updateSafeMarginField: (field: LocalSafeMarginField, value: number) => void;
  updateEntityId: (id: string, value: string) => void;
  updateEntityConfigRef: (id: string, value: number | null) => void;
  updateEntityTransform: (id: string, field: EntityTransformField, value: number) => void;
  updateEntityParam: (id: string, field: string, value: unknown) => void;
  deleteEntity: (id: string) => void;
  deleteSelectedEntities: () => void;
}

function buildBoardState(board: BoardDefinitionV2, dirty: boolean, notice: string | null = null) {
  return {
    board,
    dirty,
    notice,
    problems: validateBoardDefinition(board),
  };
}

function cloneSampleBoard(): BoardDefinitionV2 {
  return cloneBoardDefinition(sampleBoard);
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  initialized: false,
  board: cloneSampleBoard(),
  mode: 'select',
  activeTab: 'board',
  selection: { kind: 'board' },
  selectedEntityIds: [],
  placementType: null,
  continuousPlacement: false,
  camera: { x: 0, y: 0, zoom: 1 },
  dirty: false,
  lastSavedAt: null,
  notice: null,
  problems: validateBoardDefinition(sampleBoard),

  initialize: () => {
    if (get().initialized) {
      return;
    }

    let board = cloneSampleBoard();
    let notice: string | null = null;

    try {
      const draft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        board = importBoardFromJson(draft);
        notice = '已从本地草稿恢复编辑状态。';
      }
    } catch {
      board = cloneSampleBoard();
      notice = '本地草稿损坏，已回退到样板机台。';
    }

    set({
      initialized: true,
      activeTab: 'board',
      selection: { kind: 'board' },
      selectedEntityIds: [],
      ...buildBoardState(board, false, notice),
    });
  },

  clearNotice: () => {
    set({ notice: null });
  },

  setMode: (mode) => {
    set((state) => ({
      mode,
      placementType: mode === 'place' ? state.placementType : null,
    }));
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  setCamera: (camera) => {
    set((state) => ({
      camera: {
        ...state.camera,
        ...camera,
      },
    }));
  },

  setContinuousPlacement: (enabled) => {
    set({
      continuousPlacement: enabled,
      notice: enabled ? '连续放置已开启。' : '连续放置已关闭。',
    });
  },

  beginPlaceEntity: (type) => {
    set((state) => ({
      mode: 'place',
      activeTab: 'palette',
      placementType: type,
      notice: state.continuousPlacement ? `点击画布连续放置 ${type}。` : `点击画布放置 ${type}。`,
    }));
  },

  cancelPlacement: () => {
    set({
      mode: 'select',
      placementType: null,
      notice: '已取消放置模式。',
    });
  },

  selectBoard: () => {
    set({ selection: { kind: 'board' }, selectedEntityIds: [] });
  },

  selectEntity: (id, options) => {
    set((state) => {
      const currentIds = state.selectedEntityIds;

      if (options?.toggle) {
        const nextIds = currentIds.includes(id) ? currentIds.filter((selectedId) => selectedId !== id) : [...currentIds, id];
        return {
          activeTab: 'outline',
          ...buildEntitySelectionPatch(nextIds),
        };
      }

      if (options?.additive) {
        const nextIds = currentIds.includes(id) ? currentIds : [...currentIds, id];
        return {
          activeTab: 'outline',
          ...buildEntitySelectionPatch(nextIds),
        };
      }

      return {
        activeTab: 'outline',
        ...buildEntitySelectionPatch([id]),
      };
    });
  },

  selectEntities: (ids, options) => {
    set((state) => {
      const validIds = uniqueIds(ids.filter((id) => state.board.entities.some((entity) => entity.id === id)));
      const nextIds = options?.additive ? uniqueIds([...state.selectedEntityIds, ...validIds]) : validIds;
      return {
        activeTab: 'outline',
        ...buildEntitySelectionPatch(nextIds),
      };
    });
  },

  selectDecoration: (id) => {
    set({ activeTab: 'outline', selection: { kind: 'decoration', id }, selectedEntityIds: [] });
  },

  placeEntityAt: (position) => {
    set((state) => {
      if (!state.placementType) {
        return {};
      }

      const entity = createEntityDefinition(state.board, state.placementType, position);
      const board = {
        ...state.board,
        entities: [...state.board.entities, entity],
      };

      return {
        activeTab: state.continuousPlacement ? 'palette' : 'outline',
        mode: state.continuousPlacement ? 'place' : 'select',
        placementType: state.continuousPlacement ? state.placementType : null,
        selection: { kind: 'entity', id: entity.id },
        selectedEntityIds: [entity.id],
        ...buildBoardState(board, true, state.continuousPlacement ? `已放置 ${entity.type}，连续放置中。` : `已放置 ${entity.type}。`),
      };
    });
  },

  moveEntityTo: (id, position) => {
    set((state) => {
      const board = patchBoardEntity(state.board, id, (entity) => moveEntityToPosition(state.board, entity, position));
      return buildBoardState(board, true);
    });
  },

  moveEntitiesTo: (updates) => {
    set((state) => {
      if (updates.length === 0) {
        return {};
      }

      const updateMap = new Map(updates.map((update) => [update.id, update.position]));
      const board = {
        ...state.board,
        entities: state.board.entities.map((entity) => {
          const nextPosition = updateMap.get(entity.id);
          return nextPosition ? moveEntityToPosition(state.board, entity, nextPosition) : entity;
        }),
      };
      return buildBoardState(board, true);
    });
  },

  resetBoard: () => {
    const board = createEmptyBoardDefinition();
    set({
      initialized: true,
      mode: 'select',
      activeTab: 'board',
      selection: { kind: 'board' },
      selectedEntityIds: [],
      placementType: null,
      lastSavedAt: null,
      ...buildBoardState(board, true, '已创建新机台草稿。'),
    });
  },

  loadSampleBoard: () => {
    const board = cloneSampleBoard();
    set({
      mode: 'select',
      activeTab: 'outline',
      selection: { kind: 'board' },
      selectedEntityIds: [],
      placementType: null,
      ...buildBoardState(board, true, '已载入样板机台。'),
    });
  },

  importBoardFromText: (text) => {
    try {
      const board = importBoardFromJson(text);
      set({
        initialized: true,
        mode: 'select',
        activeTab: 'board',
        selection: { kind: 'board' },
        selectedEntityIds: [],
        placementType: null,
        lastSavedAt: null,
        ...buildBoardState(board, false, '已导入关卡 JSON。'),
      });
    } catch (error) {
      set({
        notice: error instanceof Error ? error.message : '导入失败。',
      });
    }
  },

  saveDraft: () => {
    const board = get().board;
    window.localStorage.setItem(DRAFT_STORAGE_KEY, exportBoardToJson(board));
    set({
      dirty: false,
      lastSavedAt: Date.now(),
      notice: '编辑器草稿已保存到本地。',
      problems: validateBoardDefinition(board),
    });
  },

  exportBoardJson: () => {
    const board = get().board;
    const problems = validateBoardDefinition(board);
    const hasError = problems.some((problem) => problem.severity === 'error');
    set({
      problems,
      notice: hasError ? '存在阻塞错误，无法导出。' : '导出 JSON 已生成。',
    });
    return hasError ? null : exportBoardToJson(board);
  },

  validate: () => {
    const problems = validateBoardDefinition(get().board);
    set({
      problems,
      notice: problems.some((problem) => problem.severity === 'error') ? '校验未通过。' : '校验通过。',
    });
    return problems;
  },

  updateBoardMeta: (field, value) => {
    set((state) => {
      const board = { ...state.board, [field]: value } as BoardDefinitionV2;
      return buildBoardState(board, true);
    });
  },

  updateLauncherField: (field, value) => {
    set((state) => {
      const board = {
        ...state.board,
        launcher:
          field === 'position'
            ? {
                ...state.board.launcher,
                position: value as LauncherDefinition['position'],
              }
            : {
                ...state.board.launcher,
                [field]: value,
              },
      } as BoardDefinitionV2;
      return buildBoardState(board, true);
    });
  },

  updateGravityField: (field, value) => {
    set((state) => {
      const board = {
        ...state.board,
        environment: {
          ...state.board.environment,
          gravity: {
            ...state.board.environment.gravity,
            [field]: value,
          },
        },
      };
      return buildBoardState(board, true);
    });
  },

  updateBoundsField: (field, value) => {
    set((state) => {
      const board = {
        ...state.board,
        environment: {
          ...state.board.environment,
          bounds: {
            ...state.board.environment.bounds,
            [field]: value,
          },
        },
      };
      return buildBoardState(board, true);
    });
  },

  updateSafeMarginField: (field, value) => {
    set((state) => {
      const board = {
        ...state.board,
        environment: {
          ...state.board.environment,
          safeMargins: {
            ...state.board.environment.safeMargins,
            [field]: value,
          },
        },
      };
      return buildBoardState(board, true);
    });
  },

  updateEntityId: (id, value) => {
    set((state) => {
      const board = patchBoardEntity(state.board, id, (entity) => ({
        ...entity,
        id: value,
      }));
      const nextSelectedEntityIds = uniqueIds(state.selectedEntityIds.map((selectedId) => (selectedId === id ? value : selectedId)));
      return {
        ...buildEntitySelectionPatch(nextSelectedEntityIds),
        ...buildBoardState(board, true),
      };
    });
  },

  updateEntityConfigRef: (id, value) => {
    set((state) => {
      const configRef = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      const board = patchBoardEntity(state.board, id, (entity) => ({
        ...entity,
        configRef,
      }));
      return buildBoardState(board, true);
    });
  },

  updateEntityTransform: (id, field, value) => {
    set((state) => {
      const board = patchBoardEntity(state.board, id, (entity) => updateEntityTransformField(state.board, entity, field, value));
      return buildBoardState(board, true);
    });
  },

  updateEntityParam: (id, field, value) => {
    set((state) => {
      const board = patchBoardEntity(state.board, id, (entity) => ({
        ...entity,
        params: {
          ...entity.params,
          [field]: value,
        },
      }));
      return buildBoardState(board, true);
    });
  },

  deleteEntity: (id) => {
    set((state) => {
      const board = {
        ...state.board,
        entities: state.board.entities.filter((entity) => entity.id !== id),
      };
      const nextSelectedEntityIds = state.selectedEntityIds.filter((selectedId) => selectedId !== id);
      return {
        activeTab: 'outline',
        ...buildEntitySelectionPatch(nextSelectedEntityIds),
        ...buildBoardState(board, true, '实体已删除。'),
      };
    });
  },

  deleteSelectedEntities: () => {
    set((state) => {
      if (state.selectedEntityIds.length === 0) {
        return {};
      }

      const selectedEntityIdSet = new Set(state.selectedEntityIds);
      const board = {
        ...state.board,
        entities: state.board.entities.filter((entity) => !selectedEntityIdSet.has(entity.id)),
      };
      return {
        activeTab: 'outline',
        ...buildEntitySelectionPatch([]),
        ...buildBoardState(board, true, `已删除 ${selectedEntityIdSet.size} 个实体。`),
      };
    });
  },
}));

function buildEntitySelectionPatch(selectedEntityIds: string[]): Pick<EditorStoreState, 'selection' | 'selectedEntityIds'> {
  const nextIds = uniqueIds(selectedEntityIds);
  if (nextIds.length === 0) {
    return {
      selection: { kind: 'board' },
      selectedEntityIds: [],
    };
  }

  return {
    selection: { kind: 'entity', id: nextIds[nextIds.length - 1] },
    selectedEntityIds: nextIds,
  };
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function patchBoardEntity(board: BoardDefinitionV2, id: string, updater: (entity: BoardEntity) => BoardEntity): BoardDefinitionV2 {
  const entityIndex = board.entities.findIndex((entity) => entity.id === id);
  if (entityIndex === -1) {
    return board;
  }

  const entities = board.entities.map((entity) => (entity.id === id ? updater(entity) : entity));
  return {
    ...board,
    entities,
  };
}

function createEntityDefinition(board: BoardDefinitionV2, type: EntityType, position: Vector2): BoardEntity {
  const snappedPosition = snapPosition(position, board);
  return {
    id: createEntityId(type, board.entities),
    type,
    transform: {
      x: snappedPosition.x,
      y: snappedPosition.y,
      scale: 1,
      rotation: 0,
    },
    params: createDefaultEntityParams(type, snappedPosition, board.entities),
  };
}

function createEntityId(type: EntityType, entities: BoardEntity[]): string {
  const prefix = type.toLowerCase();
  let counter = entities.filter((entity) => entity.type === type).length + 1;

  while (entities.some((entity) => entity.id === `${prefix}_${counter}`)) {
    counter += 1;
  }

  return `${prefix}_${counter}`;
}

function createDefaultEntityParams(type: EntityType, position: Vector2, entities: BoardEntity[]): Record<string, unknown> {
  switch (type) {
    case 'PIN_BASIC':
      return { radius: 14 };
    case 'BUMPER_ELASTIC':
      return {
        radius: 24,
        impulseMultiplier: 1.35,
        scoreValue: 100,
      };
    case 'BLOCKER_GLASS':
      return {
        shape: 'rect',
        width: 160,
        height: 24,
      };
    case 'HOLE_WORMHOLE':
      return {
        radius: 22,
        pairId: `wormhole_${countPairs(entities, 'HOLE_WORMHOLE') + 1}`,
        cooldownMs: 500,
      };
    case 'SLOT_JACKPOT':
      return {
        width: 156,
        height: 36,
        rewardId: 'reward_jackpot_01',
        multiplier: 2,
      };
    case 'SLOT_DRAIN':
      return {
        width: 128,
        height: 32,
        drainMode: 'fail',
      };
    case 'SPAWNER_EXTRA':
      return {
        spawnBallId: 1,
        spawnCount: 1,
        triggerId: `trigger_${entities.filter((entity) => entity.type === 'SPAWNER_EXTRA').length + 1}`,
        cooldownMs: 1000,
      };
    case 'SPINNER_WINDMILL':
      return {
        armLength: 52,
        armCount: 4,
        startAngle: 0,
      };
    case 'PLATFORM_MOBILE':
      return {
        width: 132,
        height: 20,
        path: [
          { x: position.x - 80, y: position.y },
          { x: position.x + 80, y: position.y },
        ],
        speed: 1.2,
        loop: true,
      };
    case 'SLOT_MACHINE_TRIGGER':
      return {
        width: 168,
        height: 42,
        rewardTableId: 'slot_reward_table_01',
        consumeBall: true,
      };
  }
}

function countPairs(entities: BoardEntity[], type: EntityType): number {
  return Math.max(0, Math.floor(entities.filter((entity) => entity.type === type).length / 2));
}

function updateEntityTransformField(board: BoardDefinitionV2, entity: BoardEntity, field: EntityTransformField, value: number): BoardEntity {
  if (field === 'x' || field === 'y') {
    return moveEntityToPosition(board, entity, {
      x: field === 'x' ? value : entity.transform.x,
      y: field === 'y' ? value : entity.transform.y,
    });
  }

  return {
    ...entity,
    transform: {
      ...entity.transform,
      [field]: value,
    },
  };
}

function moveEntityToPosition(board: BoardDefinitionV2, entity: BoardEntity, position: Vector2): BoardEntity {
  const snappedPosition = snapPosition(position, board);
  const deltaX = snappedPosition.x - entity.transform.x;
  const deltaY = snappedPosition.y - entity.transform.y;

  if (deltaX === 0 && deltaY === 0) {
    return entity;
  }

  return {
    ...entity,
    transform: {
      ...entity.transform,
      x: snappedPosition.x,
      y: snappedPosition.y,
    },
    params: shiftEntityParamsOnMove(entity, deltaX, deltaY),
  };
}

function shiftEntityParamsOnMove(entity: BoardEntity, deltaX: number, deltaY: number): Record<string, unknown> {
  if (entity.type !== 'PLATFORM_MOBILE') {
    return entity.params;
  }

  const path = readVector2Array(entity.params.path);
  if (!path) {
    return entity.params;
  }

  return {
    ...entity.params,
    path: path.map((point) => ({
      x: point.x + deltaX,
      y: point.y + deltaY,
    })),
  };
}

function snapPosition(position: Vector2, board: BoardDefinitionV2): Vector2 {
  const clamped = {
    x: clamp(position.x, 0, board.environment.bounds.width),
    y: clamp(position.y, 0, board.environment.bounds.height),
  };

  const snapEnabled = board.editorMeta?.snapEnabled ?? false;
  const snapSize = board.editorMeta?.snapSize ?? 1;
  if (!snapEnabled || snapSize <= 1) {
    return clamped;
  }

  return {
    x: Math.round(clamped.x / snapSize) * snapSize,
    y: Math.round(clamped.y / snapSize) * snapSize,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
