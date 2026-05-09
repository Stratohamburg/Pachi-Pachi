import { useGameStore } from '../../app/stores/game-store';

export function SettingsPage() {
  const navigate = useGameStore((state) => state.navigate);
  const resetSave = useGameStore((state) => state.resetSave);
  const saveData = useGameStore((state) => state.saveData);
  const updateSettings = useGameStore((state) => state.updateSettings);

  if (!saveData) {
    return null;
  }

  const settings = saveData.settings;

  return (
    <main className="page page--sub">
      <section className="hero-card narrow-card">
        <div className="title-row">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>系统设置</h1>
          </div>
          <button className="ghost-button" onClick={() => navigate('lobby')} type="button">
            返回大厅
          </button>
        </div>

        <div className="settings-list">
          <label className="setting-row">
            <span>主音量</span>
            <input max={1} min={0} onChange={(event) => updateSettings({ masterVolume: Number(event.target.value) })} step={0.05} type="range" value={settings.masterVolume} />
          </label>
          <label className="setting-row">
            <span>特效音量</span>
            <input max={1} min={0} onChange={(event) => updateSettings({ effectsVolume: Number(event.target.value) })} step={0.05} type="range" value={settings.effectsVolume} />
          </label>
          <label className="setting-row">
            <span>画质</span>
            <select onChange={(event) => updateSettings({ quality: event.target.value as typeof settings.quality })} value={settings.quality}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="setting-row setting-row--checkbox">
            <span>空格辅助蓄力</span>
            <input checked={settings.holdSpaceToCharge} onChange={(event) => updateSettings({ holdSpaceToCharge: event.target.checked })} type="checkbox" />
          </label>
          <label className="setting-row setting-row--checkbox">
            <span>震动反馈占位</span>
            <input checked={settings.vibrationEnabled} onChange={(event) => updateSettings({ vibrationEnabled: event.target.checked })} type="checkbox" />
          </label>
        </div>

        <div className="button-row">
          <button className="secondary-button" onClick={() => resetSave()} type="button">
            重置本地存档
          </button>
        </div>
      </section>
    </main>
  );
}