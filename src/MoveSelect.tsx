import { useId, useRef, useState } from "react";
import { moveByName, typeNames } from "./data";

const typeOrder = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];
const japaneseNames = new Intl.Collator("ja");

export function MoveSelect({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: [string, string][];
  onChange: (value: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const selectedType = moveByName(value)?.type;
  const normalize = (s: string) =>
    s
      .normalize("NFKC")
      .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const visible = choices
    .filter(([name, type]) =>
      normalize(`${name} ${typeNames[type]}`).includes(normalize(query)),
    )
    .sort(
      ([nameA, typeA], [nameB, typeB]) =>
        typeOrder.indexOf(typeA) - typeOrder.indexOf(typeB) ||
        japaneseNames.compare(normalize(nameA), normalize(nameB)),
    );
  function choose(name: string) {
    dialog.current?.close();
    onChange(name);
  }
  function badge(type: string) {
    return (
      <span className={`type-badge type-${type}`}>
        {typeNames[type] ?? type}
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        className={`typed-move-select ${selectedType ? `type-${selectedType}` : ""}`}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => {
          setQuery("");
          dialog.current?.showModal();
        }}
      >
        <span className="typed-move-name">{value || "未設定"}</span>
        {selectedType && badge(selectedType)}
        <span aria-hidden="true">⌄</span>
      </button>
      <dialog
        ref={dialog}
        className="modal move-picker-modal"
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dialog.current?.close();
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            dialog.current?.close();
        }}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{label}</h2>
          <button
            type="button"
            className="move-picker-close"
            aria-label="技の選択を閉じる"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <input
          autoFocus
          className="move-picker-search"
          aria-label="技名・タイプで絞り込む"
          placeholder="技名・タイプで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div
          className="typed-move-options"
          onKeyDown={(e) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
              return;
            const buttons = Array.from(
              e.currentTarget.querySelectorAll("button"),
            );
            const i = buttons.indexOf(e.target as HTMLButtonElement);
            if (i < 0) return;
            e.preventDefault();
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? buttons.length - 1
                  : (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                    buttons.length;
            buttons[next]?.focus();
          }}
        >
          <button
            type="button"
            className="typed-move-option"
            aria-pressed={!value}
            onClick={() => choose("")}
          >
            未設定
          </button>
          {visible.map(([name, type]) => (
            <button
              type="button"
              key={name}
              className={`typed-move-option type-${type}`}
              aria-pressed={value === name}
              onClick={() => choose(name)}
            >
              <span>{name}</span>
              {badge(type)}
              {value === name && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
        {!visible.length && (
          <p className="move-picker-empty">該当する技がありません。</p>
        )}
      </dialog>
    </>
  );
}
