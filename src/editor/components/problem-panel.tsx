import { useEditorStore } from '../stores/editor-store';

export function ProblemPanel() {
  const problems = useEditorStore((state) => state.problems);

  return (
    <section className="editor-problem-panel">
      <div className="editor-panel-section__header">
        <h3>Problems</h3>
        <span className="muted-note">导出和试玩会读取这里的阻塞错误</span>
      </div>

      {problems.length === 0 ? <div className="editor-empty-state">当前没有校验问题。</div> : null}

      <div className="editor-problem-list">
        {problems.map((problem) => (
          <div className={`editor-problem editor-problem--${problem.severity}`} key={problem.id}>
            <strong>{problem.severity.toUpperCase()}</strong>
            <span>{problem.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
