import type { BoardDefinitionV2 } from '../../core/types/content.types';

export function exportBoardToJson(board: BoardDefinitionV2): string {
  return `${JSON.stringify(board, null, 2)}\n`;
}
