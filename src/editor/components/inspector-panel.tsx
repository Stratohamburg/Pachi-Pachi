import { useEffect, useState, type ReactNode } from 'react';
import type { BoardEntity, Vector2 } from '../../core/types/content.types';
import { useEditorStore } from '../stores/editor-store';

export function InspectorPanel() {
  const board = useEditorStore((state) => state.board);
  const selectedEntityIds = useEditorStore((state) => state.selectedEntityIds);
  const selection = useEditorStore((state) => state.selection);
  const updateBoardMeta = useEditorStore((state) => state.updateBoardMeta);
  const updateBoundsField = useEditorStore((state) => state.updateBoundsField);
  const updateGravityField = useEditorStore((state) => state.updateGravityField);
  const updateLauncherField = useEditorStore((state) => state.updateLauncherField);
  const updateSafeMarginField = useEditorStore((state) => state.updateSafeMarginField);

  if (selectedEntityIds.length > 1) {
    const entities = board.entities.filter((item) => selectedEntityIds.includes(item.id));
    return (
      <aside className="editor-inspector">
        <MultiEntityInspector entities={entities} />
      </aside>
    );
  }

  if (selection.kind === 'entity') {
    const entity = board.entities.find((item) => item.id === selection.id);
    return (
      <aside className="editor-inspector">
        <div className="editor-panel-section__header">
          <h3>Entity Inspector</h3>
          <span className="muted-note">单选时可编辑实体参数</span>
        </div>
        {!entity ? <div className="editor-empty-state">未找到选中的实体。</div> : <EntityInspector entity={entity} />}
      </aside>
    );
  }

  if (selection.kind === 'decoration') {
    const decoration = (board.decorations ?? []).find((item) => item.id === selection.id);
    return (
      <aside className="editor-inspector">
        <div className="editor-panel-section__header">
          <h3>Decoration Inspector</h3>
        </div>
        {!decoration ? <div className="editor-empty-state">未找到选中的 Decoration。</div> : <pre className="editor-json-preview">{JSON.stringify(decoration, null, 2)}</pre>}
      </aside>
    );
  }

  return (
    <aside className="editor-inspector">
      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Board Inspector</h3>
          <span className="muted-note">Phase A 已接通顶层 Board 编辑</span>
        </div>

        <FieldGrid>
          <TextField label="boardId" onChange={(value) => updateBoardMeta('boardId', value)} value={board.boardId} />
          <TextField label="levelId" onChange={(value) => updateBoardMeta('levelId', value)} value={board.levelId ?? ''} />
          <TextField label="name" onChange={(value) => updateBoardMeta('name', value)} value={board.name} />
          <TextField label="backgroundId" onChange={(value) => updateBoardMeta('backgroundId', value)} value={board.backgroundId} />
        </FieldGrid>
      </div>

      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Launcher</h3>
        </div>
        <FieldGrid>
          <NumberField
            label="position.x"
            onChange={(value) => updateLauncherField('position', { ...board.launcher.position, x: value })}
            value={board.launcher.position.x}
          />
          <NumberField
            label="position.y"
            onChange={(value) => updateLauncherField('position', { ...board.launcher.position, y: value })}
            value={board.launcher.position.y}
          />
          <NumberField label="angle" onChange={(value) => updateLauncherField('angle', value)} value={board.launcher.angle} />
          <NumberField label="minForce" onChange={(value) => updateLauncherField('minForce', value)} step={0.001} value={board.launcher.minForce} />
          <NumberField label="maxForce" onChange={(value) => updateLauncherField('maxForce', value)} step={0.001} value={board.launcher.maxForce} />
        </FieldGrid>
      </div>

      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Environment</h3>
        </div>
        <FieldGrid>
          <NumberField label="gravity.x" onChange={(value) => updateGravityField('x', value)} step={0.1} value={board.environment.gravity.x} />
          <NumberField label="gravity.y" onChange={(value) => updateGravityField('y', value)} step={0.1} value={board.environment.gravity.y} />
          <NumberField label="bounds.width" onChange={(value) => updateBoundsField('width', value)} value={board.environment.bounds.width} />
          <NumberField label="bounds.height" onChange={(value) => updateBoundsField('height', value)} value={board.environment.bounds.height} />
          <NumberField label="safe.top" onChange={(value) => updateSafeMarginField('top', value)} value={board.environment.safeMargins.top} />
          <NumberField label="safe.right" onChange={(value) => updateSafeMarginField('right', value)} value={board.environment.safeMargins.right} />
          <NumberField label="safe.bottom" onChange={(value) => updateSafeMarginField('bottom', value)} value={board.environment.safeMargins.bottom} />
          <NumberField label="safe.left" onChange={(value) => updateSafeMarginField('left', value)} value={board.environment.safeMargins.left} />
        </FieldGrid>
      </div>

      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Runtime Preview</h3>
        </div>
        <pre className="editor-json-preview">{JSON.stringify(board, null, 2)}</pre>
      </div>
    </aside>
  );
}

function MultiEntityInspector({ entities }: { entities: BoardEntity[] }) {
  const deleteSelectedEntities = useEditorStore((state) => state.deleteSelectedEntities);
  const uniqueTypes = Array.from(new Set(entities.map((entity) => entity.type)));

  return (
    <>
      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Multi Selection</h3>
          <button className="ghost-button" onClick={deleteSelectedEntities} type="button">
            Delete All
          </button>
        </div>

        <div className="editor-mini-stats">
          <div className="editor-mini-stat">
            <span>Count</span>
            <strong>{entities.length}</strong>
          </div>
          <div className="editor-mini-stat">
            <span>Types</span>
            <strong>{uniqueTypes.length}</strong>
          </div>
          <div className="editor-mini-stat">
            <span>Mode</span>
            <strong>Marquee / Shift</strong>
          </div>
        </div>

        <div className="editor-empty-state">当前支持框选、Shift 多选和组拖拽；批量参数编辑留到下一步。</div>
      </div>

      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Selected Entities</h3>
          <span className="muted-note">{uniqueTypes.join(', ')}</span>
        </div>
        <div className="editor-list editor-list--dense">
          {entities.map((entity) => (
            <div className="editor-list-item" key={entity.id}>
              <span>{entity.id}</span>
              <strong>{entity.type}</strong>
            </div>
          ))}
        </div>
      </div>

      <pre className="editor-json-preview">{JSON.stringify(entities, null, 2)}</pre>
    </>
  );
}

function EntityInspector({ entity }: { entity: BoardEntity }) {
  const deleteEntity = useEditorStore((state) => state.deleteEntity);
  const updateEntityConfigRef = useEditorStore((state) => state.updateEntityConfigRef);
  const updateEntityId = useEditorStore((state) => state.updateEntityId);
  const updateEntityParam = useEditorStore((state) => state.updateEntityParam);
  const updateEntityTransform = useEditorStore((state) => state.updateEntityTransform);

  const handleBlockerShapeChange = (shape: 'rect' | 'polygon') => {
    updateEntityParam(entity.id, 'shape', shape);

    if (shape === 'rect') {
      updateEntityParam(entity.id, 'width', readNumber(entity.params.width, 160));
      updateEntityParam(entity.id, 'height', readNumber(entity.params.height, 24));
      return;
    }

    updateEntityParam(entity.id, 'vertices', readVector2Array(entity.params.vertices) ?? defaultBlockerVertices());
  };

  return (
    <>
      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Entity Inspector</h3>
          <button className="ghost-button" onClick={() => deleteEntity(entity.id)} type="button">
            Delete
          </button>
        </div>

        <FieldGrid>
          <TextField label="id" onChange={(value) => updateEntityId(entity.id, value)} value={entity.id} />
          <TextField label="type" onChange={() => undefined} readOnly value={entity.type} />
          <NullableNumberField label="configRef" onChange={(value) => updateEntityConfigRef(entity.id, value)} value={entity.configRef ?? null} />
          <NumberField label="transform.scale" onChange={(value) => updateEntityTransform(entity.id, 'scale', value)} step={0.1} value={entity.transform.scale} />
          <NumberField label="transform.x" onChange={(value) => updateEntityTransform(entity.id, 'x', value)} value={entity.transform.x} />
          <NumberField label="transform.y" onChange={(value) => updateEntityTransform(entity.id, 'y', value)} value={entity.transform.y} />
          <NumberField label="transform.rotation" onChange={(value) => updateEntityTransform(entity.id, 'rotation', value)} value={entity.transform.rotation} />
        </FieldGrid>
      </div>

      <div className="editor-panel-section">
        <div className="editor-panel-section__header">
          <h3>Entity Params</h3>
          <span className="muted-note">{entity.type}</span>
        </div>
        <FieldGrid>{renderEntityParamFields(entity, updateEntityParam, handleBlockerShapeChange)}</FieldGrid>
      </div>

      <div className="editor-mini-stats editor-mini-stats--stacked">
        <div className="editor-mini-stat">
          <span>Type</span>
          <strong>{entity.type}</strong>
        </div>
        <div className="editor-mini-stat">
          <span>Position</span>
          <strong>{entity.transform.x}, {entity.transform.y}</strong>
        </div>
      </div>

      <pre className="editor-json-preview">{JSON.stringify(entity, null, 2)}</pre>
    </>
  );
}

function renderEntityParamFields(
  entity: BoardEntity,
  updateEntityParam: (id: string, field: string, value: unknown) => void,
  handleBlockerShapeChange: (shape: 'rect' | 'polygon') => void,
): ReactNode {
  switch (entity.type) {
    case 'PIN_BASIC':
      return <NumberField label="radius" onChange={(value) => updateEntityParam(entity.id, 'radius', value)} value={readNumber(entity.params.radius, 14)} />;
    case 'BUMPER_ELASTIC':
      return (
        <>
          <NumberField label="radius" onChange={(value) => updateEntityParam(entity.id, 'radius', value)} value={readNumber(entity.params.radius, 24)} />
          <NumberField label="impulseMultiplier" onChange={(value) => updateEntityParam(entity.id, 'impulseMultiplier', value)} step={0.05} value={readNumber(entity.params.impulseMultiplier, 1.35)} />
          <NumberField label="scoreValue" onChange={(value) => updateEntityParam(entity.id, 'scoreValue', value)} value={readNumber(entity.params.scoreValue, 100)} />
        </>
      );
    case 'BLOCKER_GLASS': {
      const shape = readBlockerShape(entity.params.shape);
      return (
        <>
          <SelectField
            label="shape"
            onChange={(value) => handleBlockerShapeChange(value as 'rect' | 'polygon')}
            options={[
              { label: 'rect', value: 'rect' },
              { label: 'polygon', value: 'polygon' },
            ]}
            value={shape}
          />
          {shape === 'rect' ? (
            <>
              <NumberField label="width" onChange={(value) => updateEntityParam(entity.id, 'width', value)} value={readNumber(entity.params.width, 160)} />
              <NumberField label="height" onChange={(value) => updateEntityParam(entity.id, 'height', value)} value={readNumber(entity.params.height, 24)} />
            </>
          ) : (
            <VectorListField label="vertices" onChange={(value) => updateEntityParam(entity.id, 'vertices', value)} value={readVector2Array(entity.params.vertices) ?? defaultBlockerVertices()} />
          )}
        </>
      );
    }
    case 'HOLE_WORMHOLE':
      return (
        <>
          <NumberField label="radius" onChange={(value) => updateEntityParam(entity.id, 'radius', value)} value={readNumber(entity.params.radius, 22)} />
          <TextField label="pairId" onChange={(value) => updateEntityParam(entity.id, 'pairId', value)} value={readString(entity.params.pairId)} />
          <NumberField label="cooldownMs" onChange={(value) => updateEntityParam(entity.id, 'cooldownMs', value)} value={readNumber(entity.params.cooldownMs, 500)} />
        </>
      );
    case 'SLOT_JACKPOT':
      return (
        <>
          <NumberField label="width" onChange={(value) => updateEntityParam(entity.id, 'width', value)} value={readNumber(entity.params.width, 156)} />
          <NumberField label="height" onChange={(value) => updateEntityParam(entity.id, 'height', value)} value={readNumber(entity.params.height, 36)} />
          <TextField label="rewardId" onChange={(value) => updateEntityParam(entity.id, 'rewardId', value)} value={readString(entity.params.rewardId)} />
          <NumberField label="multiplier" onChange={(value) => updateEntityParam(entity.id, 'multiplier', value)} step={0.1} value={readNumber(entity.params.multiplier, 2)} />
        </>
      );
    case 'SLOT_DRAIN':
      return (
        <>
          <NumberField label="width" onChange={(value) => updateEntityParam(entity.id, 'width', value)} value={readNumber(entity.params.width, 128)} />
          <NumberField label="height" onChange={(value) => updateEntityParam(entity.id, 'height', value)} value={readNumber(entity.params.height, 32)} />
          <SelectField
            label="drainMode"
            onChange={(value) => updateEntityParam(entity.id, 'drainMode', value)}
            options={[
              { label: 'fail', value: 'fail' },
              { label: 'return', value: 'return' },
              { label: 'score', value: 'score' },
            ]}
            value={readDrainMode(entity.params.drainMode)}
          />
          <TextField label="rewardId" onChange={(value) => updateEntityParam(entity.id, 'rewardId', value)} value={readString(entity.params.rewardId)} />
        </>
      );
    case 'SPAWNER_EXTRA':
      return (
        <>
          <NumberField label="spawnBallId" onChange={(value) => updateEntityParam(entity.id, 'spawnBallId', value)} value={readNumber(entity.params.spawnBallId, 1)} />
          <NumberField label="spawnCount" onChange={(value) => updateEntityParam(entity.id, 'spawnCount', value)} value={readNumber(entity.params.spawnCount, 1)} />
          <TextField label="triggerId" onChange={(value) => updateEntityParam(entity.id, 'triggerId', value)} value={readString(entity.params.triggerId)} />
          <NumberField label="cooldownMs" onChange={(value) => updateEntityParam(entity.id, 'cooldownMs', value)} value={readNumber(entity.params.cooldownMs, 1000)} />
        </>
      );
    case 'SPINNER_WINDMILL':
      return (
        <>
          <NumberField label="armLength" onChange={(value) => updateEntityParam(entity.id, 'armLength', value)} value={readNumber(entity.params.armLength, 52)} />
          <SelectField
            label="armCount"
            onChange={(value) => updateEntityParam(entity.id, 'armCount', Number(value))}
            options={[
              { label: '2', value: '2' },
              { label: '3', value: '3' },
              { label: '4', value: '4' },
            ]}
            value={String(readNumber(entity.params.armCount, 4))}
          />
          <NumberField label="startAngle" onChange={(value) => updateEntityParam(entity.id, 'startAngle', value)} value={readNumber(entity.params.startAngle, 0)} />
        </>
      );
    case 'PLATFORM_MOBILE':
      return (
        <>
          <NumberField label="width" onChange={(value) => updateEntityParam(entity.id, 'width', value)} value={readNumber(entity.params.width, 132)} />
          <NumberField label="height" onChange={(value) => updateEntityParam(entity.id, 'height', value)} value={readNumber(entity.params.height, 20)} />
          <NumberField label="speed" onChange={(value) => updateEntityParam(entity.id, 'speed', value)} step={0.1} value={readNumber(entity.params.speed, 1.2)} />
          <ToggleField label="loop" onChange={(value) => updateEntityParam(entity.id, 'loop', value)} value={readBoolean(entity.params.loop, true)} />
          <ToggleField label="pingPong" onChange={(value) => updateEntityParam(entity.id, 'pingPong', value)} value={readBoolean(entity.params.pingPong, false)} />
          <VectorListField
            label="path"
            onChange={(value) => updateEntityParam(entity.id, 'path', value)}
            value={readVector2Array(entity.params.path) ?? defaultPlatformPath(entity.transform)}
          />
        </>
      );
    case 'SLOT_MACHINE_TRIGGER':
      return (
        <>
          <NumberField label="width" onChange={(value) => updateEntityParam(entity.id, 'width', value)} value={readNumber(entity.params.width, 168)} />
          <NumberField label="height" onChange={(value) => updateEntityParam(entity.id, 'height', value)} value={readNumber(entity.params.height, 42)} />
          <TextField label="rewardTableId" onChange={(value) => updateEntityParam(entity.id, 'rewardTableId', value)} value={readString(entity.params.rewardTableId)} />
          <ToggleField label="consumeBall" onChange={(value) => updateEntityParam(entity.id, 'consumeBall', value)} value={readBoolean(entity.params.consumeBall, true)} />
        </>
      );
  }
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="editor-field-grid">{children}</div>;
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  return (
    <label className="editor-field">
      <span>{props.label}</span>
      <input onChange={(event) => props.onChange(event.currentTarget.value)} readOnly={props.readOnly} type="text" value={props.value} />
    </label>
  );
}

function NumberField(props: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <label className="editor-field">
      <span>{props.label}</span>
      <input
        onChange={(event) => props.onChange(Number(event.currentTarget.value))}
        step={props.step ?? 1}
        type="number"
        value={Number.isFinite(props.value) ? props.value : 0}
      />
    </label>
  );
}

function NullableNumberField(props: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="editor-field">
      <span>{props.label}</span>
      <input
        onChange={(event) => {
          const nextValue = event.currentTarget.value.trim();
          props.onChange(nextValue.length === 0 ? null : Number(nextValue));
        }}
        type="number"
        value={props.value ?? ''}
      />
    </label>
  );
}

function SelectField(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <label className="editor-field">
      <span>{props.label}</span>
      <select onChange={(event) => props.onChange(event.currentTarget.value)} value={props.value}>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField(props: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="editor-field editor-field--toggle">
      <span>{props.label}</span>
      <input checked={props.value} onChange={(event) => props.onChange(event.currentTarget.checked)} type="checkbox" />
    </label>
  );
}

function VectorListField(props: { label: string; value: Vector2[]; onChange: (value: Vector2[]) => void }) {
  const [draft, setDraft] = useState(() => JSON.stringify(props.value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(JSON.stringify(props.value, null, 2));
    setError(null);
  }, [props.value]);

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(draft) as unknown;
      const points = readVector2Array(parsed);
      if (!points) {
        throw new Error('需要是 [{"x":0,"y":0}] 这种数组。');
      }

      props.onChange(points);
      setError(null);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : '无法解析坐标数组。');
    }
  };

  return (
    <label className="editor-field editor-field--full">
      <span>{props.label}</span>
      <textarea onBlur={handleBlur} onChange={(event) => setDraft(event.currentTarget.value)} value={draft} />
      <small className={error ? 'editor-field__error' : 'muted-note'}>{error ?? '修改后失焦应用。'}</small>
    </label>
  );
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
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

function readBlockerShape(value: unknown): 'rect' | 'polygon' {
  return value === 'polygon' ? 'polygon' : 'rect';
}

function readDrainMode(value: unknown): 'fail' | 'return' | 'score' {
  return value === 'return' || value === 'score' ? value : 'fail';
}

function defaultBlockerVertices(): Vector2[] {
  return [
    { x: -90, y: -18 },
    { x: 90, y: -18 },
    { x: 110, y: 20 },
    { x: -110, y: 20 },
  ];
}

function defaultPlatformPath(transform: BoardEntity['transform']): Vector2[] {
  return [
    { x: transform.x - 80, y: transform.y },
    { x: transform.x + 80, y: transform.y },
  ];
}
