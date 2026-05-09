import { useGameStore } from '../../app/stores/game-store';

const talentCards = [
  {
    body: '提高开局动能与 Fever 容错，让前几次试投更稳定。',
    key: 'FEVER_START',
    title: '起始充能',
  },
  {
    body: '提升局外初始金币，缩短早期抽卡与成长节奏。',
    key: 'STARTING_FUNDS',
    title: '创业资金',
  },
];

export function MetaTreePage() {
  const navigate = useGameStore((state) => state.navigate);
  const saveData = useGameStore((state) => state.saveData);
  const upgradeTalent = useGameStore((state) => state.upgradeTalent);

  if (!saveData) {
    return null;
  }

  return (
    <main className="page page--sub">
      <section className="hero-card narrow-card">
        <div className="title-row">
          <div>
            <p className="eyebrow">Meta Progression</p>
            <h1>局外天赋树</h1>
          </div>
          <button className="ghost-button" onClick={() => navigate('lobby')} type="button">
            返回大厅
          </button>
        </div>

        <div className="resource-strip">
          <div>
            <span>记忆碎片</span>
            <strong>{saveData.playerProfile.memoryFragments}</strong>
          </div>
        </div>

        <div className="card-grid">
          {talentCards.map((talent) => (
            <article key={talent.key} className="menu-card">
              <h2>{talent.title}</h2>
              <p>{talent.body}</p>
              <div className="summary-grid summary-grid--compact">
                <div>
                  <span>当前等级</span>
                  <strong>{saveData.playerProfile.talents[talent.key] ?? 0}</strong>
                </div>
              </div>
              <button className="primary-button" onClick={() => upgradeTalent(talent.key)} type="button">
                消耗 1 碎片升级
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}