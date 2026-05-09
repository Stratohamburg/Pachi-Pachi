import type { BoardDefinition, BoardDefinitionV2 } from '../../core/types/content.types';
import { upgradeBoardDefinition } from './board-upgrade';

export function importBoardFromJson(text: string): BoardDefinitionV2 {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('导入失败：文件不是合法的 JSON。');
  }

  if (!isBoardLike(parsed)) {
    throw new Error('导入失败：缺少 boardId、launcher、environment 或 entities。');
  }

  return upgradeBoardDefinition(parsed as BoardDefinition);
}

export async function importBoardFromFile(file: File): Promise<BoardDefinitionV2> {
  const text = await file.text();
  return importBoardFromJson(text);
}

function isBoardLike(value: unknown): value is BoardDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const board = value as Record<string, unknown>;
  return typeof board.boardId === 'string' && typeof board.name === 'string' && Array.isArray(board.entities) && isObject(board.launcher) && isObject(board.environment);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
