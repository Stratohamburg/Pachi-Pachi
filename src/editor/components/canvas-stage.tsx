import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { BoardDefinitionV2, BoardEntity, EntityType, Vector2 } from '../../core/types/content.types';
import { useEditorStore } from '../stores/editor-store';

const MARQUEE_THRESHOLD = 12;

interface InteractionPreview {
  position: Vector2;
  rawPosition: Vector2;
  clampedToBounds: boolean;
  outsideSafeZone: boolean;
}

interface DragState {
  anchorId: string;
  anchorStart: Vector2;
  pointerOffset: Vector2;
  entityStarts: Array<{ id: string; position: Vector2 }>;
  minDeltaX: number;
  maxDeltaX: number;
  minDeltaY: number;
  maxDeltaY: number;
}

interface MarqueeState {
  start: Vector2;
  current: Vector2;
  additive: boolean;
}

export function CanvasStage() {
  const board = useEditorStore((state) => state.board);
  const continuousPlacement = useEditorStore((state) => state.continuousPlacement);
  const mode = useEditorStore((state) => state.mode);
  const moveEntitiesTo = useEditorStore((state) => state.moveEntitiesTo);
  const placementType = useEditorStore((state) => state.placementType);
  const placeEntityAt = useEditorStore((state) => state.placeEntityAt);
  const selectedEntityIds = useEditorStore((state) => state.selectedEntityIds);
  const selection = useEditorStore((state) => state.selection);
  const selectBoard = useEditorStore((state) => state.selectBoard);
  const selectEntity = useEditorStore((state) => state.selectEntity);
  const selectEntities = useEditorStore((state) => state.selectEntities);
  const { bounds, safeMargins } = board.environment;
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [draggingEntityIds, setDraggingEntityIds] = useState<string[]>([]);
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const [preview, setPreview] = useState<InteractionPreview | null>(null);

  const safeWidth = Math.max(0, bounds.width - safeMargins.left - safeMargins.right);
  const safeHeight = Math.max(0, bounds.height - safeMargins.top - safeMargins.bottom);

  useEffect(() => {
    if (mode === 'place' && placementType) {
      setPreview((currentPreview) => currentPreview ?? buildPlacementPreview(board, board.launcher.position));
      return;
    }

    if (draggingEntityIds.length === 0) {
      setPreview(null);
    }
  }, [board, draggingEntityIds.length, mode, placementType]);

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (mode === 'place' && placementType) {
      const nextPreview = buildPlacementPreview(board, readCanvasPosition(event, bounds.width, bounds.height));
      setPreview(nextPreview);
      placeEntityAt(nextPreview.position);
    }
  };

  const handleCanvasMouseDown = (event: MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }

    if (mode === 'place' && placementType) {
      setPreview(buildPlacementPreview(board, readCanvasPosition(event, bounds.width, bounds.height)));
      return;
    }

    if (mode !== 'select') {
      return;
    }

    const position = readCanvasPosition(event, bounds.width, bounds.height);
    setPreview(null);
    setMarqueeState({
      start: position,
      current: position,
      additive: event.shiftKey,
    });
  };

  const handleEntityMouseDown = (event: MouseEvent<SVGGElement>, entity: BoardEntity) => {
    event.stopPropagation();

    if (event.button !== 0) {
      return;
    }

    const position = readCanvasPosition(event, bounds.width, bounds.height);
    if (mode === 'place' && placementType) {
      const nextPreview = buildPlacementPreview(board, position);
      setPreview(nextPreview);
      placeEntityAt(nextPreview.position);
      return;
    }

    const nextSelectedIds = event.shiftKey
      ? uniqueIds([...selectedEntityIds, entity.id])
      : selectedEntityIds.includes(entity.id) && selectedEntityIds.length > 1
        ? selectedEntityIds
        : [entity.id];

    if (event.shiftKey) {
      selectEntity(entity.id, { additive: true });
    } else if (!selectedEntityIds.includes(entity.id) || selectedEntityIds.length <= 1) {
      selectEntity(entity.id);
    }

    if (mode !== 'select') {
      return;
    }

    const entityStarts = board.entities
      .filter((item) => nextSelectedIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        position: { x: item.transform.x, y: item.transform.y },
      }));

    dragStateRef.current = {
      anchorId: entity.id,
      anchorStart: { x: entity.transform.x, y: entity.transform.y },
      pointerOffset: {
        x: entity.transform.x - position.x,
        y: entity.transform.y - position.y,
      },
      entityStarts,
      ...readDragLimits(entityStarts, bounds.width, bounds.height),
    };
    setDraggingEntityIds(nextSelectedIds);
    setMarqueeState(null);
  };

  const handleCanvasMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const position = readCanvasPosition(event, bounds.width, bounds.height);

    if (dragStateRef.current) {
      const dragPreview = buildDragPreview(board, dragStateRef.current, position);
      setPreview(dragPreview.preview);
      moveEntitiesTo(dragPreview.updates);
      suppressClickRef.current = true;
      return;
    }

    if (marqueeState) {
      setMarqueeState((currentState) => (currentState ? { ...currentState, current: position } : currentState));
      suppressClickRef.current = true;
      return;
    }

    if (mode === 'place' && placementType) {
      setPreview(buildPlacementPreview(board, position));
    }
  };

  const handleCanvasMouseUp = () => {
    if (dragStateRef.current) {
      clearDraggingState();
      suppressClickRef.current = true;
      return;
    }

    if (!marqueeState) {
      return;
    }

    const rect = normalizeRect(marqueeState.start, marqueeState.current);
    const isMarqueeSelection = rect.width >= MARQUEE_THRESHOLD || rect.height >= MARQUEE_THRESHOLD;
    if (isMarqueeSelection) {
      const ids = board.entities.filter((entity) => isPointInsideRect(entity.transform, rect)).map((entity) => entity.id);
      if (ids.length === 0 && !marqueeState.additive) {
        selectBoard();
      } else {
        selectEntities(ids, { additive: marqueeState.additive });
      }
      suppressClickRef.current = true;
    } else if (!marqueeState.additive) {
      selectBoard();
    }

    setMarqueeState(null);
  };

  const handleCanvasMouseLeave = () => {
    clearDraggingState();
    setMarqueeState(null);
    if (mode !== 'place') {
      setPreview(null);
    }
  };

  const clearDraggingState = () => {
    dragStateRef.current = null;
    setDraggingEntityIds([]);
  };

  const interactionPreview = mode === 'place' && placementType ? preview : draggingEntityIds.length > 0 ? preview : null;
  const marqueeRect = marqueeState ? normalizeRect(marqueeState.start, marqueeState.current) : null;
  const primarySelectionId = selection.kind === 'entity' ? selection.id : null;

  return (
    <section className="editor-canvas-panel">
      <div className={`editor-canvas-frame ${mode === 'place' && placementType ? 'is-place-mode' : ''} ${draggingEntityIds.length > 0 ? 'is-dragging' : ''}`} role="presentation">
        <svg
          className="editor-canvas-svg"
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseLeave={handleCanvasMouseLeave}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        >
          <defs>
            <pattern height="40" id="editor-grid" patternUnits="userSpaceOnUse" width="40">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect fill="url(#editor-grid)" height={bounds.height} rx="40" width={bounds.width} x="0" y="0" />
          <rect className={`editor-canvas-board ${interactionPreview?.clampedToBounds ? 'is-boundary-hit' : ''}`} fill="rgba(16,18,28,0.95)" height={bounds.height} rx="40" stroke="rgba(255,255,255,0.12)" strokeWidth="4" width={bounds.width} x="0" y="0" />
          <rect className={`editor-canvas-safe-zone ${interactionPreview?.outsideSafeZone ? 'is-boundary-hit' : ''}`} fill="rgba(0,229,255,0.08)" height={safeHeight} rx="20" stroke="rgba(0,229,255,0.45)" strokeDasharray="16 12" strokeWidth="4" width={safeWidth} x={safeMargins.left} y={safeMargins.top} />

          <g className="editor-canvas-launcher">
            <line
              stroke="rgba(255,51,102,0.7)"
              strokeWidth="8"
              x1={board.launcher.position.x}
              x2={board.launcher.position.x + Math.cos((board.launcher.angle * Math.PI) / 180) * 72}
              y1={board.launcher.position.y}
              y2={board.launcher.position.y + Math.sin((board.launcher.angle * Math.PI) / 180) * 72}
            />
            <circle cx={board.launcher.position.x} cy={board.launcher.position.y} fill="#FF3366" r="18" stroke="white" strokeWidth="3" />
          </g>

          {interactionPreview ? (
            <g className="editor-canvas-guides">
              <line x1={interactionPreview.position.x} x2={interactionPreview.position.x} y1={0} y2={bounds.height} />
              <line x1={0} x2={bounds.width} y1={interactionPreview.position.y} y2={interactionPreview.position.y} />
            </g>
          ) : null}

          {mode === 'place' && placementType && interactionPreview ? renderPlacementPreview(placementType, interactionPreview.position) : null}

          {board.entities.map((entity) =>
            renderEntity(
              entity,
              selectedEntityIds.includes(entity.id),
              primarySelectionId === entity.id,
              draggingEntityIds.includes(entity.id),
              mode,
              selectEntity,
              handleEntityMouseDown,
            ),
          )}

          {marqueeRect && (marqueeRect.width >= 1 || marqueeRect.height >= 1) ? <rect className="editor-canvas-marquee" height={marqueeRect.height} width={marqueeRect.width} x={marqueeRect.x} y={marqueeRect.y} /> : null}
        </svg>
      </div>
    </section>
  );
}

function renderEntity(
  entity: BoardEntity,
  selected: boolean,
  primarySelected: boolean,
  dragging: boolean,
  mode: 'select' | 'place' | 'vertex-edit' | 'pan' | 'play-test',
  onSelect: (id: string, options?: { additive?: boolean; toggle?: boolean }) => void,
  onMouseDown: (event: MouseEvent<SVGGElement>, entity: BoardEntity) => void,
) {
  const color = primarySelected ? '#E2B714' : selected ? '#7AD7FF' : entityColor(entity.type);
  const commonProps = {
    className: `editor-canvas-entity ${selected ? 'is-selected' : ''} ${dragging ? 'is-dragging' : ''}`,
    onClick: (event: MouseEvent<SVGGElement>) => {
      event.stopPropagation();
      if (mode !== 'place') {
        onSelect(entity.id, event.shiftKey ? { additive: true } : undefined);
      }
    },
    onMouseDown: (event: MouseEvent<SVGGElement>) => onMouseDown(event, entity),
  };

  if (entity.type === 'PIN_BASIC' || entity.type === 'BUMPER_ELASTIC' || entity.type === 'HOLE_WORMHOLE') {
    const radius = readPositiveNumber(entity.params.radius, entity.type === 'BUMPER_ELASTIC' ? 24 : 14);
    return (
      <g key={entity.id} {...commonProps} transform={`translate(${entity.transform.x} ${entity.transform.y})`}>
        <circle fill={color} opacity={0.85} r={radius} stroke="rgba(255,255,255,0.65)" strokeWidth="3" />
      </g>
    );
  }

  if (entity.type === 'SPINNER_WINDMILL') {
    const armLength = readPositiveNumber(entity.params.armLength, 40);
    const armCount = readPositiveNumber(entity.params.armCount, 4);
    return (
      <g key={entity.id} {...commonProps} transform={`translate(${entity.transform.x} ${entity.transform.y}) rotate(${entity.transform.rotation})`}>
        {Array.from({ length: Math.max(2, Math.floor(armCount)) }).map((_, index) => (
          <line key={index} stroke={color} strokeLinecap="round" strokeWidth="10" x1="0" x2={armLength} y1="0" y2="0" transform={`rotate(${(360 / Math.max(2, Math.floor(armCount))) * index})`} />
        ))}
        <circle fill="#0A0A10" r="12" stroke="rgba(255,255,255,0.8)" strokeWidth="3" />
      </g>
    );
  }

  if (entity.type === 'PLATFORM_MOBILE') {
    const width = readPositiveNumber(entity.params.width, 132);
    const height = readPositiveNumber(entity.params.height, 20);
    const path = readVector2Array(entity.params.path);

    return (
      <g key={entity.id} {...commonProps}>
        {path ? <polyline fill="none" points={path.map((point) => `${point.x},${point.y}`).join(' ')} stroke="rgba(255,255,255,0.35)" strokeDasharray="12 10" strokeWidth="4" /> : null}
        <g transform={`translate(${entity.transform.x} ${entity.transform.y}) rotate(${entity.transform.rotation})`}>
          <rect fill={color} height={height} opacity={0.85} rx="10" stroke="rgba(255,255,255,0.65)" strokeWidth="3" width={width} x={-width / 2} y={-height / 2} />
        </g>
      </g>
    );
  }

  if (entity.type === 'BLOCKER_GLASS' && entity.params.shape === 'polygon' && Array.isArray(entity.params.vertices)) {
    const points = readVector2Array(entity.params.vertices);
    if (points) {
      return (
        <g key={entity.id} {...commonProps} transform={`translate(${entity.transform.x} ${entity.transform.y}) rotate(${entity.transform.rotation})`}>
          <polygon fill={color} opacity={0.6} points={points.map((point) => `${point.x},${point.y}`).join(' ')} stroke="rgba(255,255,255,0.75)" strokeWidth="3" />
        </g>
      );
    }
  }

  const width = readPositiveNumber(entity.params.width, 124);
  const height = readPositiveNumber(entity.params.height, 28);
  return (
    <g key={entity.id} {...commonProps} transform={`translate(${entity.transform.x} ${entity.transform.y}) rotate(${entity.transform.rotation})`}>
      <rect fill={color} height={height} opacity={0.82} rx="14" stroke="rgba(255,255,255,0.65)" strokeWidth="3" width={width} x={-width / 2} y={-height / 2} />
    </g>
  );
}

function entityColor(type: BoardEntity['type']) {
  switch (type) {
    case 'PIN_BASIC':
      return '#CAD4F4';
    case 'BUMPER_ELASTIC':
      return '#FF9A5E';
    case 'BLOCKER_GLASS':
      return '#8FD2FF';
    case 'HOLE_WORMHOLE':
      return '#AE7BFF';
    case 'SLOT_JACKPOT':
      return '#F7B733';
    case 'SLOT_DRAIN':
      return '#C34F79';
    case 'SPAWNER_EXTRA':
      return '#6DE39B';
    case 'SPINNER_WINDMILL':
      return '#00E5FF';
    case 'PLATFORM_MOBILE':
      return '#B6FFC9';
    case 'SLOT_MACHINE_TRIGGER':
      return '#FF66C4';
  }
}

function readPositiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
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

function readCanvasPosition(event: MouseEvent<SVGElement>, width: number, height: number): Vector2 {
  const svgElement = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement;
  const rect = svgElement?.getBoundingClientRect();
  if (!rect) {
    return { x: 0, y: 0 };
  }

  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  };
}

function buildPlacementPreview(board: BoardDefinitionV2, rawPosition: Vector2): InteractionPreview {
  const snappedToGrid = snapToGrid(rawPosition, board);
  const position = clampToBoard(snappedToGrid, board.environment.bounds.width, board.environment.bounds.height);
  return {
    position,
    rawPosition,
    clampedToBounds: position.x !== snappedToGrid.x || position.y !== snappedToGrid.y,
    outsideSafeZone: !isInsideSafeZone(position, board),
  };
}

function buildDragPreview(board: BoardDefinitionV2, dragState: DragState, rawPointerPosition: Vector2): { preview: InteractionPreview; updates: Array<{ id: string; position: Vector2 }> } {
  const snappedAnchorPosition = snapToGrid(
    {
      x: rawPointerPosition.x + dragState.pointerOffset.x,
      y: rawPointerPosition.y + dragState.pointerOffset.y,
    },
    board,
  );
  const desiredDelta = {
    x: snappedAnchorPosition.x - dragState.anchorStart.x,
    y: snappedAnchorPosition.y - dragState.anchorStart.y,
  };
  const clampedDelta = {
    x: clamp(desiredDelta.x, dragState.minDeltaX, dragState.maxDeltaX),
    y: clamp(desiredDelta.y, dragState.minDeltaY, dragState.maxDeltaY),
  };
  const anchorPosition = {
    x: dragState.anchorStart.x + clampedDelta.x,
    y: dragState.anchorStart.y + clampedDelta.y,
  };
  const updates = dragState.entityStarts.map((entry) => ({
    id: entry.id,
    position: {
      x: entry.position.x + clampedDelta.x,
      y: entry.position.y + clampedDelta.y,
    },
  }));

  return {
    preview: {
      position: anchorPosition,
      rawPosition: snappedAnchorPosition,
      clampedToBounds: clampedDelta.x !== desiredDelta.x || clampedDelta.y !== desiredDelta.y,
      outsideSafeZone: updates.some((entry) => !isInsideSafeZone(entry.position, board)),
    },
    updates,
  };
}

function readDragLimits(entityStarts: Array<{ id: string; position: Vector2 }>, width: number, height: number) {
  const xs = entityStarts.map((entry) => entry.position.x);
  const ys = entityStarts.map((entry) => entry.position.y);

  return {
    minDeltaX: -Math.min(...xs),
    maxDeltaX: width - Math.max(...xs),
    minDeltaY: -Math.min(...ys),
    maxDeltaY: height - Math.max(...ys),
  };
}

function snapToGrid(position: Vector2, board: BoardDefinitionV2): Vector2 {
  const snapEnabled = board.editorMeta?.snapEnabled ?? false;
  const snapSize = board.editorMeta?.snapSize ?? 1;
  if (!snapEnabled || snapSize <= 1) {
    return position;
  }

  return {
    x: Math.round(position.x / snapSize) * snapSize,
    y: Math.round(position.y / snapSize) * snapSize,
  };
}

function clampToBoard(position: Vector2, width: number, height: number): Vector2 {
  return {
    x: clamp(position.x, 0, width),
    y: clamp(position.y, 0, height),
  };
}

function isInsideSafeZone(position: Vector2, board: BoardDefinitionV2): boolean {
  const { bounds, safeMargins } = board.environment;
  return (
    position.x >= safeMargins.left &&
    position.x <= bounds.width - safeMargins.right &&
    position.y >= safeMargins.top &&
    position.y <= bounds.height - safeMargins.bottom
  );
}

function normalizeRect(start: Vector2, current: Vector2) {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

function isPointInsideRect(point: Vector2, rect: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function renderPlacementPreview(type: EntityType, position: Vector2) {
  const previewEntity: BoardEntity = {
    id: '__preview__',
    type,
    transform: {
      x: position.x,
      y: position.y,
      scale: 1,
      rotation: 0,
    },
    params: previewParams(type, position),
  };

  return <g className="editor-canvas-preview" pointerEvents="none">{renderEntity(previewEntity, false, false, false, 'place', () => undefined, () => undefined)}</g>;
}

function previewParams(type: EntityType, position: Vector2): Record<string, unknown> {
  switch (type) {
    case 'PIN_BASIC':
      return { radius: 14 };
    case 'BUMPER_ELASTIC':
      return { radius: 24, impulseMultiplier: 1.35 };
    case 'BLOCKER_GLASS':
      return { shape: 'rect', width: 160, height: 24 };
    case 'HOLE_WORMHOLE':
      return { radius: 22, pairId: 'preview_pair' };
    case 'SLOT_JACKPOT':
      return { width: 156, height: 36, rewardId: 'preview' };
    case 'SLOT_DRAIN':
      return { width: 128, height: 32 };
    case 'SPAWNER_EXTRA':
      return { width: 42, height: 42 };
    case 'SPINNER_WINDMILL':
      return { armLength: 52, armCount: 4 };
    case 'PLATFORM_MOBILE':
      return {
        width: 132,
        height: 20,
        path: [
          { x: position.x - 80, y: position.y },
          { x: position.x + 80, y: position.y },
        ],
      };
    case 'SLOT_MACHINE_TRIGGER':
      return { width: 168, height: 42, rewardTableId: 'preview' };
  }
}
