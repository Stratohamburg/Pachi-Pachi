import type { BoardDefinitionV2 } from '../../core/types/content.types';

export type EditorMode = 'select' | 'place' | 'vertex-edit' | 'pan' | 'play-test';
export type EditorPanelTab = 'palette' | 'board' | 'outline';
export type EditorProblemSeverity = 'error' | 'warning' | 'info';

export interface EditorProblemTarget {
  kind: 'board' | 'entity' | 'decoration';
  field?: string;
  id?: string;
}

export interface EditorProblem {
  id: string;
  severity: EditorProblemSeverity;
  message: string;
  target?: EditorProblemTarget;
}

export interface EditorCamera {
  x: number;
  y: number;
  zoom: number;
}

export type EditorSelection = { kind: 'board' } | { kind: 'entity'; id: string } | { kind: 'decoration'; id: string };

export interface EditorDraft {
  board: BoardDefinitionV2;
  savedAt: number;
}
