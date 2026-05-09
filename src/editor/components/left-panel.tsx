import type { EntityType } from '../../core/types/content.types';
import { useEditorStore } from '../stores/editor-store';

const PALETTE_ITEMS: Array<{ label: string; type: EntityType | null; description: string; disabled?: boolean }> = [
  { label: '基础钉子', type: 'PIN_BASIC', description: '小半径碰撞点，适合铺基础弹跳路径。' },
  { label: '弹力柱', type: 'BUMPER_ELASTIC', description: '带冲量增幅的高反馈碰撞点。' },
  { label: '自定义挡板', type: 'BLOCKER_GLASS', description: '默认先放置矩形挡板，可在 Inspector 切到 polygon。' },
  { label: '普通落点槽', type: 'SLOT_DRAIN', description: '底部失败 / 回收落点区域。' },
  { label: '大奖槽', type: 'SLOT_JACKPOT', description: '底部高价值结算槽。' },
  { label: '老虎机触发区', type: 'SLOT_MACHINE_TRIGGER', description: '用于触发老虎机奖励逻辑。' },
  { label: '传送门 / 黑洞', type: 'HOLE_WORMHOLE', description: '需成对配置 pairId。' },
  { label: '额外生成器', type: 'SPAWNER_EXTRA', description: '由 triggerId 控制的额外出球器。' },
  { label: '风车 / 旋转机关', type: 'SPINNER_WINDMILL', description: '旋转式击打组件。' },
  { label: '移动平台', type: 'PLATFORM_MOBILE', description: '按 path 在固定轨迹上往返。' },
  { label: '纯视觉装饰', type: null, description: 'Decoration 仍留到后续阶段。', disabled: true },
];

export function LeftPanel() {
  const activeTab = useEditorStore((state) => state.activeTab);
  const board = useEditorStore((state) => state.board);
  const beginPlaceEntity = useEditorStore((state) => state.beginPlaceEntity);
  const cancelPlacement = useEditorStore((state) => state.cancelPlacement);
  const continuousPlacement = useEditorStore((state) => state.continuousPlacement);
  const mode = useEditorStore((state) => state.mode);
  const placementType = useEditorStore((state) => state.placementType);
  const selectedEntityIds = useEditorStore((state) => state.selectedEntityIds);
  const selection = useEditorStore((state) => state.selection);
  const setContinuousPlacement = useEditorStore((state) => state.setContinuousPlacement);
  const selectBoard = useEditorStore((state) => state.selectBoard);
  const selectDecoration = useEditorStore((state) => state.selectDecoration);
  const selectEntity = useEditorStore((state) => state.selectEntity);
  const setActiveTab = useEditorStore((state) => state.setActiveTab);

  return (
    <aside className="editor-sidebar">
      <div className="editor-tab-row">
        <button className={`chip-button ${activeTab === 'palette' ? 'is-active' : ''}`} onClick={() => setActiveTab('palette')} type="button">
          Palette
        </button>
        <button className={`chip-button ${activeTab === 'board' ? 'is-active' : ''}`} onClick={() => setActiveTab('board')} type="button">
          Board
        </button>
        <button className={`chip-button ${activeTab === 'outline' ? 'is-active' : ''}`} onClick={() => setActiveTab('outline')} type="button">
          Outline
        </button>
      </div>

      {activeTab === 'palette' ? (
        <section className="editor-panel-section">
          <div className="editor-panel-section__header">
            <h3>Palette</h3>
            {mode === 'place' && placementType ? (
              <button className="ghost-button" onClick={cancelPlacement} type="button">
                取消放置
              </button>
            ) : (
              <span className="muted-note">选择一种实体后，点击中间画布放置。</span>
            )}
          </div>
          <div className="editor-inline-tools">
            <button className={`chip-button ${continuousPlacement ? 'is-active' : ''}`} onClick={() => setContinuousPlacement(!continuousPlacement)} type="button">
              连续放置 {continuousPlacement ? 'On' : 'Off'}
            </button>
            <span className="muted-note">开启后，放置完成后保持当前实体类型。</span>
          </div>
          {mode === 'place' && placementType ? <div className="editor-empty-state">当前待放置: {placementType}</div> : null}
          <div className="editor-palette-list">
            {PALETTE_ITEMS.map((item) => (
              <button
                className={`editor-palette-item ${placementType === item.type && mode === 'place' ? 'is-active' : ''}`}
                disabled={item.disabled}
                key={item.label}
                onClick={() => {
                  if (item.type) {
                    beginPlaceEntity(item.type);
                  }
                }}
                type="button"
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
                <small>{item.type ?? 'Decoration'}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'board' ? (
        <section className="editor-panel-section">
          <div className="editor-panel-section__header">
            <h3>Board Summary</h3>
            <button className="ghost-button" onClick={selectBoard} type="button">
              选择 Board
            </button>
          </div>

          <div className="editor-mini-stats">
            <div className="editor-mini-stat">
              <span>Version</span>
              <strong>{board.version}</strong>
            </div>
            <div className="editor-mini-stat">
              <span>Entities</span>
              <strong>{board.entities.length}</strong>
            </div>
            <div className="editor-mini-stat">
              <span>Decorations</span>
              <strong>{board.decorations?.length ?? 0}</strong>
            </div>
          </div>

          <div className="editor-list">
            <button className={`editor-list-item ${selection.kind === 'board' && selectedEntityIds.length === 0 ? 'is-active' : ''}`} onClick={selectBoard} type="button">
              <span>Launcher</span>
              <strong>{board.launcher.position.x}, {board.launcher.position.y}</strong>
            </button>
            <button className={`editor-list-item ${selection.kind === 'board' && selectedEntityIds.length === 0 ? 'is-active' : ''}`} onClick={selectBoard} type="button">
              <span>Environment</span>
              <strong>{board.environment.bounds.width} x {board.environment.bounds.height}</strong>
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'outline' ? (
        <section className="editor-panel-section">
          <div className="editor-panel-section__header">
            <h3>Outline</h3>
            <span className="muted-note">点击节点切换 Inspector</span>
          </div>

          <div className="editor-outline-group">
            <p className="eyebrow">Entities</p>
            <div className="editor-list editor-list--dense">
              {board.entities.map((entity) => (
                <button
                  className={`editor-list-item ${selectedEntityIds.includes(entity.id) ? 'is-active' : ''}`}
                  key={entity.id}
                  onClick={(event) => selectEntity(entity.id, event.shiftKey ? { additive: true } : undefined)}
                  type="button"
                >
                  <span>{entity.id}</span>
                  <strong>{entity.type}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="editor-outline-group">
            <p className="eyebrow">Decorations</p>
            <div className="editor-list editor-list--dense">
              {(board.decorations ?? []).length === 0 ? <div className="editor-empty-state">当前没有 Decoration。</div> : null}
              {(board.decorations ?? []).map((decoration) => (
                <button
                  className={`editor-list-item ${selection.kind === 'decoration' && selection.id === decoration.id ? 'is-active' : ''}`}
                  key={decoration.id}
                  onClick={() => selectDecoration(decoration.id)}
                  type="button"
                >
                  <span>{decoration.id}</span>
                  <strong>{decoration.layer}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
