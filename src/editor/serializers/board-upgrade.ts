import type { BoardDefinition, BoardDefinitionV2, EditorMeta } from '../../core/types/content.types';

const DEFAULT_EDITOR_META: EditorMeta = {
  guideVisible: true,
  lastCamera: { x: 0, y: 0 },
  lastZoom: 1,
  snapEnabled: true,
  snapSize: 24,
};

export function cloneBoardDefinition(board: BoardDefinitionV2): BoardDefinitionV2 {
  return JSON.parse(JSON.stringify(board)) as BoardDefinitionV2;
}

export function createEmptyBoardDefinition(): BoardDefinitionV2 {
  return {
    version: 2,
    boardId: 'board_new',
    levelId: 'board_new',
    name: '未命名机台',
    backgroundId: 'bg_arcade_starter',
    launcher: {
      position: { x: 360, y: 1110 },
      angle: -92,
      minForce: 0.016,
      maxForce: 0.034,
    },
    environment: {
      gravity: { x: 0, y: 9.81 },
      bounds: { width: 720, height: 1280 },
      safeMargins: { top: 32, right: 24, bottom: 48, left: 24 },
    },
    entities: [],
    decorations: [],
    editorMeta: { ...DEFAULT_EDITOR_META },
  };
}

export function upgradeBoardDefinition(board: BoardDefinition): BoardDefinitionV2 {
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
