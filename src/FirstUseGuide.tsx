import { useLayoutEffect, useRef, useState } from "react";
import "./first-use-guide.css";

type GuidePage = "home" | "battle" | "party" | "speed";

const steps: {
  title: string;
  description: string;
  page: GuidePage;
  target: string;
}[] = [
  {
    title: "ダメージ計算",
    description:
      "攻撃側と受け側を選び、使うわざを決めるとダメージを確認できます。パーティや履歴からも選べます。",
    page: "battle",
    target: "attack-picker",
  },
  {
    title: "すばやさ比較",
    description:
      "ここではポケモンを直接選んで、性格・能力ポイント・ランクなどを含めたすばやさを比較できます。",
    page: "speed",
    target: "speed-setup",
  },
  {
    title: "パーティ編成",
    description:
      "3つのパーティにそれぞれ6体まで登録できます。メンバーを編集したら保存ボタンで端末に保存します。",
    page: "party",
    target: "party-settings",
  },
  {
    title: "能力ランク",
    description:
      "能力ランクは対戦中の変化を入力する場所です。たとえば「つるぎのまい」を使った後なら、こうげき（A）を＋2にします。",
    page: "battle",
    target: "rank-controls",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function panelPosition(rect: Rect, measuredHeight: number) {
  const margin = 16;
  const width = Math.min(420, window.innerWidth - margin * 2);
  const height = Math.min(measuredHeight, window.innerHeight - margin * 2);
  const below = rect.top + rect.height + height + 20 <= window.innerHeight;
  const above = rect.top - height - 20 >= margin;
  const top = below
    ? rect.top + rect.height + 16
    : above
      ? rect.top - height - 16
      : Math.min(
          window.innerHeight - height - margin,
          Math.max(margin, rect.top + rect.height + 16),
        );
  const left = Math.min(
    window.innerWidth - width - margin,
    Math.max(margin, rect.left + rect.width / 2 - width / 2),
  );
  return { top, left, width };
}

export function FirstUseGuide({
  page,
  onNavigate,
  onClose,
}: {
  page: GuidePage;
  onNavigate: (page: GuidePage) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    nextRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useLayoutEffect(() => {
    if (page !== step.page) {
      onNavigate(step.page);
      return;
    }
    const target = document.querySelector<HTMLElement>(
      `[data-guide-target="${step.target}"]`,
    );
    if (!target) {
      setTargetRect(null);
      return;
    }
    if (
      step.target === "rank-controls" &&
      window.matchMedia("(max-width: 600px)").matches
    ) {
      const headerBottom =
        document
          .querySelector<HTMLElement>(".site-header")
          ?.getBoundingClientRect().bottom ?? 0;
      const targetTop = Math.max(16, headerBottom + 16);
      const rect = target.getBoundingClientRect();
      window.scrollTo({
        top: Math.max(0, window.scrollY + rect.top - targetTop),
        behavior: "auto",
      });
    } else {
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }
    const update = () => {
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      update();
      secondFrame = window.requestAnimationFrame(update);
    });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [index, page]);

  useLayoutEffect(() => {
    const height = panelRef.current?.getBoundingClientRect().height ?? 0;
    if (height && height !== panelHeight) setPanelHeight(height);
  }, [index, page, targetRect, panelHeight]);

  function advance() {
    if (index === steps.length - 1) onClose();
    else setIndex((current) => current + 1);
  }

  const position =
    targetRect && panelHeight ? panelPosition(targetRect, panelHeight) : null;
  return (
    <dialog
      ref={dialogRef}
      className="first-use-guide-dialog"
      aria-labelledby="first-use-guide-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {targetRect && (
        <div
          className="first-use-guide-spotlight"
          aria-hidden="true"
          style={{
            top: Math.max(4, targetRect.top - 6),
            left: Math.max(4, targetRect.left - 6),
            width: Math.min(window.innerWidth - 8, targetRect.width + 12),
            height: Math.min(window.innerHeight - 8, targetRect.height + 12),
          }}
        />
      )}
      <section
        ref={panelRef}
        className="first-use-guide-panel"
        style={
          position
            ? {
                top: position.top,
                left: position.left,
                width: position.width,
                transform: "none",
              }
            : undefined
        }
        aria-live="polite"
      >
        <div className="first-use-guide-heading">
          <span>
            はじめての方へ{" "}
            <small>
              {index + 1} / {steps.length}
            </small>
          </span>
          <button
            type="button"
            className="first-use-guide-close"
            onClick={onClose}
            aria-label="使い方ガイドを閉じる"
          >
            ×
          </button>
        </div>
        <h2 id="first-use-guide-title">{step.title}</h2>
        <p>{step.description}</p>
        {!targetRect && (
          <p className="first-use-guide-location" role="status">
            案内する場所を探しています…
          </p>
        )}
        <div className="first-use-guide-progress" aria-hidden="true">
          {steps.map((item, stepIndex) => (
            <span
              key={item.target}
              className={stepIndex <= index ? "is-active" : ""}
            />
          ))}
        </div>
        <div className="first-use-guide-actions">
          <button
            type="button"
            className="first-use-guide-skip"
            onClick={onClose}
          >
            スキップ
          </button>
          {index > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIndex((current) => current - 1)}
            >
              戻る
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="primary-button"
            onClick={advance}
          >
            {index === steps.length - 1 ? "完了" : "次へ"}
          </button>
        </div>
      </section>
    </dialog>
  );
}
