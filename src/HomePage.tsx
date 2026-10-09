type ToolPage = "battle" | "speed" | "party";

function ToolIcon({ kind }: { kind: ToolPage | "guide" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "battle" ? (
        <>
          <rect x="10" y="4" width="28" height="40" rx="5" />
          <path d="M16 11h16v9H16zM17 27h2m10 0h2m-14 7h2m10 0h2" />
        </>
      ) : kind === "speed" ? (
        <>
          <path d="M7 37a21 21 0 1 1 34 0M24 8v4M9 17l4 2m26-2-4 2M24 28l10-11" />
          <circle cx="24" cy="29" r="3" />
        </>
      ) : kind === "party" ? (
        <>
          <circle cx="24" cy="12" r="6" />
          <path d="M14 39v-8a10 10 0 0 1 20 0v8zM7 14a5 5 0 1 0 0 10m34-10a5 5 0 1 1 0 10M8 29a7 7 0 0 0-5 7v3h5m32-10a7 7 0 0 1 5 7v3h-5" />
        </>
      ) : (
        <>
          <path d="M24 12C17 7 10 6 3 8v31c8-2 14-1 21 4 7-5 13-6 21-4V8c-7-2-14-1-21 4v31" />
          <path d="M10 15l7 2m-7 6 7 2m14-8 7-2m-7 10 7-2" />
        </>
      )}
    </svg>
  );
}

const tools = [
  {
    page: "battle",
    title: "ダメージ計算",
    description: "相手に与えるダメージを確認",
    action: "計算する",
  },
  {
    page: "speed",
    title: "すばやさ比較",
    description: "先手を取れる相手を見つける",
    action: "比較する",
  },
  {
    page: "party",
    title: "パーティ編成",
    description: "自分だけの6体を管理",
    action: "編成する",
  },
] as const;

export function HomePage({
  navigate,
  onHelp,
}: {
  navigate: (page: ToolPage) => void;
  onHelp: () => void;
}) {
  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <img
          className="home-hero-image"
          src="/images/battle-note-hero.png"
          width="1672"
          height="941"
          fetchPriority="high"
          alt="青と紫に輝くスタジアムで、空中のメガガブリアスZを、はどうだんを構えたメガルカリオZが迎え撃つ"
        />
        <div className="home-hero-copy">
          <h1 id="home-title">
            次の一手に、
            <br />
            もっと自信を。
          </h1>
          <p>ダメージとすばやさを比較して、対戦の準備を。</p>
          <span className="home-badge">
            <span />
            シングルバトル対応
          </span>
        </div>
      </section>
      <section className="home-tools" aria-labelledby="home-tools-title">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">YOUR NEXT MOVE</span>
            <h2 id="home-tools-title">対戦の準備を、ここから。</h2>
          </div>
          <p>
            相手を知り、自分の強みを知る。
            <br />
            次の一手を考える、3つのツール。
          </p>
        </div>
        <div className="home-tool-grid">
          {tools.map((tool, index) => (
            <button
              key={tool.page}
              className={`home-tool home-tool-${tool.page}`}
              onClick={() => navigate(tool.page)}
            >
              <span className="home-tool-number">0{index + 1}</span>
              <span className="home-tool-icon">
                <ToolIcon kind={tool.page} />
              </span>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <span className="home-tool-link">
                {tool.action}
                <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <button className="home-guide" onClick={onHelp}>
        <span className="home-guide-icon">
          <ToolIcon kind="guide" />
        </span>
        <span className="home-guide-copy">
          <strong>はじめての方へ</strong>
          <span>ポケモンを選んで、条件を設定するだけ。</span>
        </span>
        <span className="home-guide-link">
          使い方を見る <span aria-hidden="true">→</span>
        </span>
      </button>
    </>
  );
}
