import type { RecoveryMode } from "./item-recovery";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DamageView,
  SpeedView,
  SideControls,
  RankControls,
  FieldSideControls,
  MoveSlots,
  OpponentInfo,
  AssumptionsView,
  PredictionView,
  UsagePanel,
  StickyDamageSummary,
  useBattleUsage,
} from "./BattleFeatures";
import {
  defaultSide,
  damageFor,
  type BattleField,
  type SideState,
} from "./battle";
import { repeatedAttackKnockout } from "./item-recovery";
import { unknownInfo, type KnownInfo, type OpponentSlot } from "./predictions";
import { HomePage } from "./HomePage";
import "./home.css";
import { SpeedPage } from "./SpeedPage";
import { FirstUseGuide } from "./FirstUseGuide";
import {
  FIRST_USE_GUIDE_STORAGE_KEY,
  markFirstUseGuideSeen,
  shouldShowFirstUseGuide,
} from "./first-use-guide-state";
import { ItemSelect } from "./ItemSelect";
import { PointInput } from "./PointInput";
import {
  duplicateItemWarning,
  partyHasChanges,
  partySaveErrors,
} from "./party-validation";
import { writeSavedData } from "./persistence";
import {
  DefaultBuildSelectionGate,
  resolvePopularBuildSelection,
} from "./build-defaults";
import {
  canApplyStarterParty,
  resolveStarterPartySelection,
  type SkippedStarterMega,
  type StarterPartyPick,
} from "./starter-party";
import { loadUsage, loadUsageIndex, usageCompatible } from "./usage";
import {
  addHistory,
  movePairs,
  artwork,
  pokemonAppearance,
  resolveBattleBuild,
  getNatureModifier,
  getPokemon,
  usageSourcePokemon,
  learnableMoves,
  initialData,
  makeBuild,
  natures,
  pokemon,
  statLabels,
  statShort,
  typeNames,
  normalizeSavedData,
  type Build,
  type SavedData,
} from "./data";

type IconName =
  | "bolt"
  | "target"
  | "shield"
  | "speed"
  | "team"
  | "chevron"
  | "swap"
  | "plus"
  | "close"
  | "check"
  | "arrow"
  | "download"
  | "upload"
  | "info"
  | "sun"
  | "leaf"
  | "clock"
  | "search"
  | "edit"
  | "refresh";
type AppPage = "home" | "battle" | "party" | "speed";
type BuildSelectionTarget =
  | "attack"
  | "defense"
  | { party: number; member: number };
function Icon({
  name,
  size = 20,
  ...props
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8z" />,
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3" />
      </>
    ),
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />,
    speed: (
      <>
        <path d="M4 18a9 9 0 1 1 16 0M12 14l5-6M5 13H3m18 0h-2M12 4V2" />
        <circle cx="12" cy="14" r="1.5" />
      </>
    ),
    team: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    swap: <path d="M4 7h16l-4-4M20 17H4l4 4" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v.2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3C6 2 2 8 6 16c8 5 15 0 14-13ZM4 21 15 10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    edit: (
      <>
        <path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="閉じる">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`type-badge type-${type}`}>
      <span className="type-dot" />
      {typeNames[type] ?? type}
    </span>
  );
}
function Picture({
  id,
  item,
  className = "",
}: {
  id: number;
  item?: string;
  className?: string;
}) {
  const species = pokemonAppearance(id, item);
  return (
    <img
      src={artwork(species.speciesId!)}
      loading="lazy"
      decoding="async"
      alt={species.name}
      className={className}
      draggable="false"
    />
  );
}

function MemberEditor({
  build,
  onSave,
  close,
}: {
  build: Build;
  onSave: (b: Build) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(build));
  const effectiveDraft = resolveBattleBuild(draft);
  const p = getPokemon(effectiveDraft.pokemonId);
  const total = draft.points.reduce((a, b) => a + b, 0);
  return (
    <Modal title={`${p.name}の育成型`} close={close}>
      <div className="member-editor">
        <div className="member-editor-top">
          <Picture id={p.id} item={draft.item} />
          <div>
            <small>No. {p.number}</small>
            <h3>{p.name}</h3>
            <div className="type-list">
              {p.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        </div>
        <div className="build-form">
          <label>
            とくせい
            <select
              value={effectiveDraft.ability}
              disabled={effectiveDraft.pokemonId !== draft.pokemonId}
              onChange={(e) => setDraft({ ...draft, ability: e.target.value })}
            >
              {p.abilities.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            せいかく
            <select
              value={draft.nature}
              onChange={(e) => setDraft({ ...draft, nature: e.target.value })}
            >
              {natures.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="full-width">
            もちもの
            <ItemSelect
              pokemon={getPokemon(draft.pokemonId)}
              value={draft.item}
              onChange={(item) => setDraft({ ...draft, item })}
            />
          </label>
        </div>
        <div className="point-editor">
          <div className="row-label">
            <span>能力ポイント</span>
            <span>
              <b>{total}</b> / 66
            </span>
          </div>
          <div className="point-grid">
            {draft.points.map((v, i) => (
              <label
                key={`${draft.pokemonId}-${i}`}
                className={v > 0 ? "has-points" : ""}
                data-nature-modifier={getNatureModifier(draft.nature, i)}
              >
                <span>{statShort[i]}</span>
                <PointInput
                  max={Math.min(32, 66 - total + v)}
                  value={v}
                  label={`${statLabels[i]}の能力ポイント`}
                  onChange={(value) => {
                    const points = [...draft.points];
                    points[i] = value;
                    setDraft({ ...draft, points });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
        <MoveSlots build={draft} onChange={setDraft} />
        <div className="editor-actions">
          <button className="secondary-button" onClick={close}>
            キャンセル
          </button>
          <button className="primary-button" onClick={() => onSave(draft)}>
            <Icon name="check" size={17} />
            編集中のパーティに反映
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Picker({
  onSelect,
  close,
  history,
  status,
  title = "ポケモンを選ぶ",
  excludedIds = [],
  onClear,
  noHistory = false,
  quickParty,
  onQuickPartySelect,
}: {
  onSelect: (build: Build, source: "pokemon" | "history") => void;
  close: () => void;
  history: Build[];
  status?: string;
  title?: string;
  excludedIds?: number[];
  onClear?: () => void;
  noHistory?: boolean;
  quickParty?: SavedData["parties"][number];
  onQuickPartySelect?: (build: Build) => void;
}) {
  const [query, setQuery] = useState("");
  const normalize = (s: string) =>
    s
      .normalize("NFKC")
      .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const matches = pokemon.filter(
    (p) =>
      (normalize(p.name).includes(normalize(query)) ||
        p.number.includes(query)) &&
      !excludedIds.includes(p.id),
  );
  const quickPartyMembers = quickParty?.members.flatMap((build, index) => {
    if (!build) return [];
    return pokemon.some((entry) => entry.id === build.pokemonId)
      ? [{ build, index }]
      : [];
  });
  return (
    <Modal title={title} close={close} wide>
      {quickParty && (
        <section className="picker-party" aria-label="現在のパーティ">
          <div className="picker-party-heading">
            <span>現在のパーティ</span>
            <strong>{quickParty.name}</strong>
          </div>
          {quickPartyMembers?.length ? (
            <div className="picker-party-grid">
              {quickPartyMembers.map(({ build, index }) => {
                const name = pokemonAppearance(
                  build.pokemonId,
                  build.item,
                ).name;
                return (
                  <button
                    className="picker-party-item"
                    key={index}
                    title={`${name}の保存済みの型を適用`}
                    aria-label={`${index + 1}枠目 ${name}の保存済みの型を適用`}
                    onClick={() => onQuickPartySelect?.(build)}
                  >
                    <small>{index + 1}</small>
                    <Picture id={build.pokemonId} item={build.item} />
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="picker-party-empty">登録されたポケモンはありません</p>
          )}
        </section>
      )}
      <label className="search-input">
        <Icon name="search" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・図鑑番号で検索"
          aria-label="ポケモンを検索"
        />
        <kbd>検索</kbd>
      </label>
      {onClear && (
        <button className="secondary-button picker-clear" onClick={onClear}>
          未選択にする
        </button>
      )}
      {status && (
        <p className="sidebar-note" role="status">
          {status}
        </p>
      )}
      {!noHistory && !query && history.length > 0 && (
        <>
          <p className="section-label">最近使った型</p>
          <div className="picker-history">
            {history.map((b, i) => (
              <button
                key={i}
                onClick={() => onSelect(structuredClone(b), "history")}
              >
                <Picture id={b.pokemonId} item={b.item} />
                <span>
                  {getPokemon(b.pokemonId).name}
                  <small>
                    {b.nature} / {b.item}
                  </small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="section-label picker-label">
        <span>対応ポケモン</span>
        <span>{matches.length} 件</span>
      </div>
      <div className="picker-grid">
        {matches.map((p) => (
          <button
            className="picker-item"
            key={p.id}
            onClick={() => onSelect(makeBuild(p.id), "pokemon")}
          >
            <Picture id={p.id} />
            <small>No. {p.number}</small>
            <strong>{p.name}</strong>
            <div>
              {p.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </button>
        ))}
      </div>
      {!matches.length && (
        <div className="empty-search">
          <Icon name="search" size={32} />
          <p>該当するポケモンが見つかりません</p>
          <small>358フォームから選択できます。</small>
          <button className="text-button" onClick={() => setQuery("")}>
            検索をクリア
          </button>
        </div>
      )}
    </Modal>
  );
}

type CardProps = {
  side: "attack" | "defense";
  build: Build;
  selected: boolean;
  setBuild: (b: Build) => void;
  history: Build[];
  pick: () => void;
  move: string;
  setMove: (m: string) => void;
  opponentMove: string;
  setOpponentMove: (m: string) => void;
  hp: number;
  setHp: (n: number) => void;
  sideState: SideState;
  onSideChange: (s: SideState) => void;
};
function PokemonCard({
  side,
  build,
  setBuild,
  history,
  pick,
  move,
  setMove,
  opponentMove,
  setOpponentMove,
  hp,
  setHp,
  sideState,
  onSideChange,
  selected,
}: CardProps) {
  const attack = side === "attack";
  if (!selected)
    return (
      <section
        className={`pokemon-card ${side} pokemon-card-unselected`}
        aria-label={attack ? "攻撃側の設定" : "受け側の設定"}
      >
        <div className="side-heading">
          <span>
            <Icon name={attack ? "target" : "shield"} size={16} />
            {attack ? "攻撃側" : "受け側"}
            <small>{attack ? "ATTACKER" : "DEFENDER"}</small>
          </span>
        </div>
        <div className="pokemon-unselected">
          <p>{attack ? "攻撃側" : "受け側"}は未選択です</p>
          <button
            className="pokemon-name"
            data-guide-target={attack ? "attack-picker" : undefined}
            onClick={pick}
          >
            <span>
              <small>対戦に使うポケモンを選ぶ</small>
              <strong>ポケモンを選択</strong>
            </span>
            <span className="name-change">
              <Icon name="plus" size={18} />
            </span>
          </button>
        </div>
        <RankControls
          label={attack ? "攻撃側" : "受け側"}
          value={sideState}
          onChange={onSideChange}
          dataGuideTarget={attack ? "rank-controls" : undefined}
        />
      </section>
    );
  const effectiveBuild = resolveBattleBuild(build);
  const p = getPokemon(effectiveBuild.pokemonId);
  const sum = build.points.reduce((a, b) => a + b, 0);
  function updatePoints(index: number, value: number) {
    const rest = sum - build.points[index];
    const points = [...build.points];
    points[index] = Math.min(
      32,
      66 - rest,
      Math.max(0, Math.floor(value || 0)),
    );
    setBuild({ ...build, points });
  }
  return (
    <section
      className={`pokemon-card ${side}`}
      aria-label={attack ? "攻撃側の設定" : "受け側の設定"}
    >
      <div className="side-heading">
        <span>
          <Icon name={attack ? "target" : "shield"} size={16} />
          {attack ? "攻撃側" : "受け側"}
          <small>{attack ? "ATTACKER" : "DEFENDER"}</small>
        </span>
      </div>
      <button
        className="pokemon-name"
        onClick={pick}
        data-guide-target={attack ? "attack-picker" : undefined}
      >
        <span>
          <small>No. {p.number}</small>
          <strong>{p.name}</strong>
        </span>
        <span className="name-change">
          <Icon name="chevron" size={18} />
        </span>
      </button>
      <div className="pokemon-stage">
        <div className="pokemon-art">
          <div className="art-orbit" />
          <Picture id={p.id} item={build.item} />
        </div>
        <div className="pokemon-profile">
          <div className="type-list">
            {p.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          <span className="tiny-label">
            種族値 <span>BASE STATS</span>
          </span>
          <div className="mini-stats">
            {p.stats.map((s, i) => (
              <span key={i}>
                <small>{statShort[i]}</small>
                <strong>{s}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="build-form">
        <label>
          とくせい
          <select
            value={effectiveBuild.ability}
            disabled={effectiveBuild.pokemonId !== build.pokemonId}
            onChange={(e) => setBuild({ ...build, ability: e.target.value })}
            aria-label={`${attack ? "攻撃側" : "受け側"}の特性`}
          >
            {p.abilities.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <small className="selected-build-value" aria-hidden="true">
            {effectiveBuild.ability}
          </small>
        </label>
        <label>
          せいかく
          <select
            value={build.nature}
            onChange={(e) => setBuild({ ...build, nature: e.target.value })}
            aria-label={`${attack ? "攻撃側" : "受け側"}の性格`}
          >
            {natures.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="full-width">
          もちもの
          <ItemSelect
            pokemon={getPokemon(build.pokemonId)}
            value={build.item}
            onChange={(item) => setBuild({ ...build, item })}
            label={`${attack ? "攻撃側" : "受け側"}のもちもの`}
          />
          <small className="selected-build-value" aria-hidden="true">
            {build.item}
          </small>
        </label>
      </div>
      <div className="point-editor">
        <div className="row-label">
          <span>能力ポイント</span>
          <span>
            <b>{sum}</b> / 66
          </span>
        </div>
        <div className="point-grid">
          {build.points.map((v, i) => (
            <label
              key={`${build.pokemonId}-${i}`}
              className={v > 0 ? "has-points" : ""}
              data-nature-modifier={getNatureModifier(build.nature, i)}
            >
              <span>{statShort[i]}</span>
              <PointInput
                max={Math.min(32, 66 - sum + v)}
                value={v}
                onChange={(value) => updatePoints(i, value)}
                label={`${attack ? "攻撃側" : "受け側"}の${statLabels[i]}ポイント`}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="move-editor">
        <div className="row-label">
          <span>使用するわざ</span>
          <span>{attack ? "1つ選択" : "行動順の仮定"}</span>
        </div>
        {attack ? (
          <div className="move-grid">
            {movePairs(build).map(([name, type]) => (
              <button
                key={name}
                className={`move-button ${move === name ? "selected" : ""}`}
                onClick={() => setMove(name)}
                aria-pressed={move === name}
              >
                <span className={`move-type type-${type}`} />
                <span>{name}</span>
                {move === name && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>
        ) : (
          <select
            className="opponent-move-select"
            value={opponentMove}
            onChange={(e) => setOpponentMove(e.target.value)}
            aria-label="受け側の使用するわざ"
          >
            {learnableMoves(p).map(([name]) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        )}
        {!attack && (
          <small
            className="selected-build-value selected-move-value"
            aria-hidden="true"
          >
            {opponentMove}
          </small>
        )}
        <details className="move-set-editor">
          <summary>わざセットを編集</summary>
          <MoveSlots build={build} onChange={setBuild} />
        </details>
      </div>
      {!attack && (
        <div className="hp-editor">
          <div className="row-label">
            <span>現在のHP</span>
            <span>
              <b>{hp}</b> %
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={hp}
            onChange={(e) => setHp(Number(e.target.value))}
            aria-label="受け側の残りHP"
            style={{ "--range": `${hp}%` } as React.CSSProperties}
          />
          <div className="hp-marks">
            <span>1%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}
      <RankControls
        label={attack ? "攻撃側" : "受け側"}
        value={sideState}
        onChange={onSideChange}
        dataGuideTarget={attack ? "rank-controls" : undefined}
      />
      <div className="history-strip">
        <span className="history-label">
          <Icon name="clock" size={13} />
          履歴
        </span>
        <div className="history-items">
          {Array.from({ length: 6 }, (_, i) =>
            history[i] ? (
              <button
                key={i}
                onClick={() => {
                  const b = structuredClone(history[i]);
                  setBuild(b);
                  if (attack) setMove(b.moves[0]);
                }}
                aria-label={`${attack ? "攻撃側" : "受け側"}の履歴 ${getPokemon(history[i].pokemonId).name}`}
                title={`${getPokemon(history[i].pokemonId).name} / ${history[i].nature}`}
              >
                <Picture id={history[i].pokemonId} item={history[i].item} />
              </button>
            ) : (
              <span key={i} className="empty-history" />
            ),
          )}
        </div>
        <span className="history-count">{history.length}/6</span>
      </div>
    </section>
  );
}

const STORAGE_KEY = "battle-note-ui-v1";
function readInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const guideMarker = localStorage.getItem(FIRST_USE_GUIDE_STORAGE_KEY);
    const showFirstUseGuide = shouldShowFirstUseGuide(raw, guideMarker);
    if (raw === null)
      return {
        data: initialData(),
        error: "",
        firstUse: true,
        hasSavedData: false,
        showFirstUseGuide,
      };
    const value: unknown = JSON.parse(raw);
    const normalized = normalizeSavedData(value);
    if (normalized)
      return {
        data: normalized,
        error: "",
        firstUse: false,
        hasSavedData: true,
        showFirstUseGuide,
      };
    return {
      data: initialData(),
      error: "保存データを読み込めませんでした。初期データを表示しています。",
      firstUse: false,
      hasSavedData: false,
      showFirstUseGuide,
    };
  } catch {
    return {
      data: initialData(),
      error: "端末の保存データを読み込めませんでした。",
      firstUse: false,
      hasSavedData: false,
      showFirstUseGuide: false,
    };
  }
}
export default function App() {
  const [initial] = useState(readInitial);
  const [saved, setSaved] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [persistenceAllowed, setPersistenceAllowed] = useState(!initial.error);
  const [hasPersistedData, setHasPersistedData] = useState(
    initial.hasSavedData,
  );
  const [starterPartyStatus, setStarterPartyStatus] = useState<
    | "idle"
    | "loading"
    | "ready"
    | "unsaved"
    | "failed"
    | "skipped"
    | "stored"
    | "edited"
    | "saved"
  >(initial.firstUse ? "idle" : "stored");
  const [starterPartyPicks, setStarterPartyPicks] = useState<
    StarterPartyPick[]
  >([]);
  const [skippedStarterMegas, setSkippedStarterMegas] = useState<
    SkippedStarterMega[]
  >([]);
  const [attack, setAttack] = useState<Build>(() => makeBuild(445));
  const [defense, setDefenseState] = useState<Build>(() => makeBuild(1000));
  const [attackSelected, setAttackSelected] = useState(false);
  const [defenseSelected, setDefenseSelected] = useState(false);
  const hasMatchup = attackSelected && defenseSelected;
  const defaultBuildSelection = useRef(new DefaultBuildSelectionGate());
  const starterPartySelection = useRef(new DefaultBuildSelectionGate());
  const starterPartyTouched = useRef(false);
  const starterStorageConflict = useRef(false);
  const [defaultBuildPending, setDefaultBuildPending] = useState(false);
  const opponentBuilds = useRef<Record<number, Build>>({});
  function cancelDefaultSelection(target?: string) {
    if (!defaultBuildSelection.current.cancel(target)) return false;
    setDefaultBuildPending(false);
    setToast((current) => (current === "採用データを確認中…" ? "" : current));
    return true;
  }
  function markStarterPartyTouched() {
    starterPartyTouched.current = true;
    starterPartySelection.current.cancel("starter:party");
    setStarterPartyPicks([]);
    setSkippedStarterMegas([]);
    setStarterPartyStatus((status) =>
      status === "ready" || status === "unsaved" || status === "edited"
        ? "edited"
        : status === "stored" || status === "saved" || status === "failed"
          ? status
          : "skipped",
    );
  }
  function setDefense(next: Build) {
    cancelDefaultSelection("battle:defense");
    if (defenseSelected)
      opponentBuilds.current[defense.pokemonId] = structuredClone(defense);
    const previous = opponentBuilds.current[next.pokemonId],
      observed = knownBySpecies[next.pokemonId];
    if (next.pokemonId !== defense.pokemonId && previous && observed) {
      const restored = { ...next };
      for (const key of ["ability", "item", "nature", "points"] as const)
        if (observed[key]) Object.assign(restored, { [key]: previous[key] });
      setDefenseState(restored);
    } else setDefenseState(next);
    setDefenseSelected(true);
  }
  const [move, setMove] = useState("じしん");
  const [hp, setHp] = useState(100);
  const [screen, setScreen] = useState(false);
  const [weather, setWeather] = useState("なし");
  const [terrain, setTerrain] = useState("なし");
  const [trickRoom, setTrickRoom] = useState(false);
  const [page, setPage] = useState<AppPage>("home");
  const [partyIndex, setPartyIndex] = useState(0);
  const [partyTarget, setPartyTarget] = useState<"attack" | "defense">(
    "attack",
  );
  const [partySaveAttempt, setPartySaveAttempt] = useState<number | null>(null);
  const [partyExportAttempted, setPartyExportAttempted] = useState(false);
  const [partyDrafts, setPartyDrafts] = useState(() =>
    structuredClone(initial.data.parties),
  );
  const partyDraftsRef = useRef(partyDrafts);
  partyDraftsRef.current = partyDrafts;
  const [picker, setPicker] = useState<
    "attack" | "defense" | { member: number; party: number } | null
  >(null);
  const [previewPicker, setPreviewPicker] = useState<number | null>(null);
  const [pickerStatus, setPickerStatus] = useState("");
  const [editingMember, setEditingMember] = useState<{
    party: number;
    member: number;
    build: Build;
  } | null>(null);
  const [help, setHelp] = useState(false);
  const [guideOpen, setGuideOpen] = useState(initial.showFirstUseGuide);
  const guideOriginPage = useRef<AppPage>("home");
  const guideOriginScroll = useRef(0);
  const guideReturnFocus = useRef<HTMLElement | null>(null);
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState("");
  const pendingPersistenceToast = useRef("");
  const prewrittenSavedData = useRef<SavedData | null>(null);
  const [pendingImport, setPendingImport] = useState<SavedData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const [resultObservation, setResultObservation] = useState({
    ready: false,
    visible: false,
  });
  useLayoutEffect(() => {
    setResultObservation({ ready: false, visible: false });
    if (page !== "battle") return;
    const target = resultRef.current;
    if (!target) return;
    const isResultVisible = () => {
      const rect = target.getBoundingClientRect();
      const headerBottom =
        headerRef.current?.getBoundingClientRect().bottom ?? 0;
      return (
        rect.bottom > Math.max(0, headerBottom) && rect.top < window.innerHeight
      );
    };
    const updateResultVisibility = (visible: boolean) => {
      setResultObservation((previous) =>
        previous.ready && previous.visible === visible
          ? previous
          : { ready: true, visible },
      );
    };
    if (typeof IntersectionObserver === "undefined") {
      const checkVisibility = () => updateResultVisibility(isResultVisible());
      checkVisibility();
      window.addEventListener("scroll", checkVisibility, { passive: true });
      window.addEventListener("resize", checkVisibility);
      return () => {
        window.removeEventListener("scroll", checkVisibility);
        window.removeEventListener("resize", checkVisibility);
      };
    }
    let observer: IntersectionObserver | null = null;
    const observeAtCurrentHeaderSize = () => {
      observer?.disconnect();
      const headerHeight = Math.ceil(
        headerRef.current?.getBoundingClientRect().height ?? 0,
      );
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries.find((item) => item.target === target);
          if (entry) updateResultVisibility(entry.isIntersecting);
        },
        { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(target);
    };
    observeAtCurrentHeaderSize();
    const headerObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(observeAtCurrentHeaderSize);
    if (headerRef.current) headerObserver?.observe(headerRef.current);
    window.addEventListener("resize", observeAtCurrentHeaderSize);
    return () => {
      observer?.disconnect();
      headerObserver?.disconnect();
      window.removeEventListener("resize", observeAtCurrentHeaderSize);
    };
  }, [page]);
  const party = partyDrafts[partyIndex];
  const partyItemWarning = duplicateItemWarning(party);
  const partyDirty = partyHasChanges(party, saved.parties[partyIndex]);
  const partyDirtyStates = partyDrafts.map((draft, index) =>
    partyHasChanges(draft, saved.parties[index]),
  );
  const partySaveLabels = partyDirtyStates.map((dirty) =>
    dirty ? "未保存" : hasPersistedData ? "保存済み" : "サンプル・未保存",
  );
  const starterPartyStatusMessage = {
    idle: "初回利用では採用順位を確認して6体を選びます。",
    loading: "採用順位を確認して、スタンダードパーティを用意しています。",
    ready: "採用順位から6体を選びました。育成型や持ち物は編集できます。",
    edited: "パーティを編集中です。変更は保存ボタンから保存できます。",
    saved: "パーティを保存しました。編集を続けられます。",
    unsaved:
      "採用順位から6体を選びましたが、端末には保存できませんでした。編集内容を書き出して保管してください。",
    failed:
      "採用順位を取得できないためサンプルを表示しています。次回起動時に再試行します。",
    skipped: "パーティへの操作を優先し、自動選出を取り消しました。",
    stored: "保存済みのパーティを読み込みました。",
  }[starterPartyStatus];
  const starterRankingSummary = starterPartyPicks.length
    ? `採用順位：${starterPartyPicks
        .map(
          (pick) =>
            `${pick.rank}位 ${pick.name}${pick.mega ? `（${pick.megaSource === "stone" ? pick.item : "直接メガ"}）` : ""}`,
        )
        .join("、")}${
        skippedStarterMegas.length
          ? `。${skippedStarterMegas
              .map(
                (pick) =>
                  `${pick.rank}位 ${pick.name}${pick.megaSource === "stone" ? `（${pick.item}）` : "（直接メガ）"}を3体目以降のメガ候補として除外`,
              )
              .join("、")}`
          : ""
      }`
    : "";
  const dirtyPartyIndexes = partyDirtyStates.flatMap((dirty, index) =>
    dirty ? [index] : [],
  );
  const hasUnsavedPartyDrafts = partyDirtyStates.some(Boolean);
  const partyExportErrors = partyExportAttempted
    ? partySaveErrors(partyDrafts, dirtyPartyIndexes)
    : [];
  const [attackSide, setAttackSide] = useState(defaultSide);
  const [defenseExtra, setDefenseExtra] = useState(defaultSide);
  const defenseSide = { ...defenseExtra, hp, reflect: screen };
  const [gravity, setGravity] = useState(false);
  function updateDefenseSide(s: SideState) {
    setDefenseExtra(s);
    setHp(s.hp);
    setScreen(s.reflect);
  }
  const [crit, setCrit] = useState(false);
  const [hits, setHits] = useState<number>();
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>("auto");
  const [opponentMove, setOpponentMove] = useState(defense.moves[0]);
  const [knownBySpecies, setKnownBySpecies] = useState<
    Record<number, KnownInfo>
  >({});
  const known = knownBySpecies[defense.pokemonId] ?? unknownInfo();
  const [opponents, setOpponents] = useState<OpponentSlot[]>(() =>
    Array.from({ length: 6 }, () => ({ id: null, state: "unknown" })),
  );
  const predictionOpponents = opponents.map((slot) =>
    slot.id === null
      ? slot
      : {
          ...slot,
          observedBuild:
            defenseSelected && slot.id === defense.pokemonId
              ? defense
              : (opponentBuilds.current[slot.id] ?? makeBuild(slot.id)),
          known: knownBySpecies[slot.id] ?? unknownInfo(),
        },
  );
  const field: BattleField = { weather, terrain, trickRoom, gravity };
  const matchup = {
    attack,
    defense,
    move,
    attackSide,
    defenseSide,
    field,
    crit,
    hits,
    recoveryMode,
  };
  const calculation = useMemo(() => {
    if (page !== "battle" || !hasMatchup)
      return { damage: null, repeatedKO: null, error: "" };
    try {
      const damage = damageFor(
        attack,
        defense,
        move,
        attackSide,
        defenseSide,
        field,
        crit,
        hits,
        recoveryMode,
      );
      const repeatedKO =
        damage.koChance === null || damage.statusMove
          ? null
          : repeatedAttackKnockout({
              ...damage.repeatedKOInput,
              useLimit: 10,
            });
      return { damage, repeatedKO, error: "" };
    } catch (e) {
      return {
        damage: null,
        repeatedKO: null,
        error: e instanceof Error ? e.message : "この条件では計算できません",
      };
    }
  }, [
    page,
    hasMatchup,
    attackSelected,
    defenseSelected,
    attack,
    defense,
    move,
    attackSide,
    defenseExtra,
    hp,
    screen,
    weather,
    terrain,
    trickRoom,
    gravity,
    crit,
    hits,
    recoveryMode,
  ]);
  const showStickySummary =
    page === "battle" &&
    hasMatchup &&
    resultObservation.ready &&
    !resultObservation.visible;
  const usageData = useBattleUsage(
    defenseSelected
      ? usageSourcePokemon(defense.pokemonId)?.speciesId
      : undefined,
  );
  const usage = usageData.entry?.data;
  useEffect(() => {
    if (!attack.moves.includes(move)) setMove(attack.moves[0] ?? "");
  }, [attack.moves, move]);
  useEffect(() => {
    setOpponentMove(defense.moves[0] ?? "");
  }, [defense.pokemonId]);

  useEffect(() => {
    const alreadyWritten = saved === prewrittenSavedData.current;
    prewrittenSavedData.current = null;
    if (alreadyWritten) {
      pendingPersistenceToast.current = "";
      return;
    }
    if (saved === initial.data) return;

    // Keep unreadable user data intact, including after calculations or edits.
    // Only an explicitly confirmed backup import authorizes replacing it.
    let result: ReturnType<typeof writeSavedData>;
    try {
      // Keep the localStorage getter inside this catch boundary too.
      result = writeSavedData(
        localStorage,
        STORAGE_KEY,
        saved,
        persistenceAllowed,
      );
    } catch {
      result = { ok: false, reason: "failed" };
    }

    const successToast = pendingPersistenceToast.current;
    pendingPersistenceToast.current = "";
    if (result.ok) {
      setStorageError("");
      setHasPersistedData(true);
      if (successToast) setToast(successToast);
      return;
    }

    reportPersistenceFailure(result.reason);
  }, [saved, persistenceAllowed, initial.data]);
  useEffect(() => {
    if (!initial.showFirstUseGuide) return;
    try {
      markFirstUseGuideSeen(localStorage);
    } catch {
      // If browser storage is unavailable, this guide cannot be remembered.
    }
  }, [initial]);
  useEffect(() => {
    if (!initial.firstUse) return;
    if (starterPartyTouched.current) {
      setStarterPartyStatus("skipped");
      return;
    }
    const ticket = starterPartySelection.current.begin("starter:party");
    setStarterPartyStatus("loading");
    void resolveStarterPartySelection(
      starterPartySelection.current,
      ticket,
      () => loadUsageIndex(),
      loadUsage,
    ).then((result) => {
      if (!result) return;
      if (!result.ok) {
        setStarterPartyStatus("failed");
        setToast(
          "採用順位から6体を確保できませんでした。サンプルを表示し、次回起動時に再試行します。",
        );
        return;
      }

      let storageValue: string | null;
      try {
        storageValue = localStorage.getItem(STORAGE_KEY);
      } catch {
        setPersistenceAllowed(false);
        setStarterPartyStatus("skipped");
        setStorageError(
          "保存状態を確認できないため、初回選出を適用しませんでした。",
        );
        return;
      }
      const currentParty = partyDraftsRef.current[0];
      if (
        !currentParty ||
        !canApplyStarterParty({
          firstUse: initial.firstUse,
          storageValue,
          userEdited: starterPartyTouched.current,
          draft: currentParty,
          initial: initial.data.parties[0],
        })
      ) {
        if (storageValue !== null) {
          starterStorageConflict.current = true;
          setPersistenceAllowed(false);
          setHasPersistedData(true);
          setStorageError(
            "保存データがすでに作成されたため、現在の画面からの上書きを停止しました。再読み込みしてください。",
          );
          setStarterPartyStatus("stored");
        } else {
          setStarterPartyStatus("skipped");
        }
        return;
      }

      const next: SavedData = {
        ...initial.data,
        parties: [result.party, ...initial.data.parties.slice(1)],
      };
      const persisted = commitSavedData(next, true);
      if (!persisted && starterStorageConflict.current) {
        setStarterPartyStatus("stored");
        return;
      }

      const nextDrafts = structuredClone(partyDraftsRef.current);
      nextDrafts[0] = result.party;
      partyDraftsRef.current = nextDrafts;
      setPartyDrafts(nextDrafts);
      setStarterPartyPicks(result.picks);
      setSkippedStarterMegas(result.skippedMegas);
      setStarterPartyStatus(persisted ? "ready" : "unsaved");
      if (persisted) {
        const megaCount = result.picks.filter((pick) => pick.mega).length;
        setToast(`採用順位上位から6体を選出しました（メガ${megaCount}体）。`);
      }
    });
    return () => {
      starterPartySelection.current.cancel("starter:party");
    };
  }, [initial]);
  useEffect(() => {
    if (!toast || toast === "採用データを確認中…") return;
    const t = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  function buildTargetKey(target: BuildSelectionTarget) {
    return typeof target === "string"
      ? `battle:${target}`
      : `party:${target.party}:${target.member}`;
  }
  function pickerTarget(): BuildSelectionTarget | null {
    if (picker === "attack" || picker === "defense") return picker;
    if (picker) return { party: picker.party, member: picker.member };
    return null;
  }
  function applyBuildSelection(target: BuildSelectionTarget, build: Build) {
    if (target === "attack") {
      updateAttack(build);
      setMove(build.moves[0] ?? "");
    } else if (target === "defense") {
      setDefense(build);
      setOpponentMove(build.moves[0] ?? "");
    } else {
      setPartyDrafts((drafts) =>
        drafts.map((p, i) =>
          i === target.party
            ? {
                ...p,
                members: p.members.map((b, j) =>
                  j === target.member ? build : b,
                ),
              }
            : p,
        ),
      );
    }
  }
  function popularSelectionMessage(
    name: string,
    result: Awaited<ReturnType<typeof resolvePopularBuildSelection>>,
  ) {
    if (!result) return "";
    const updateError = result.cacheError || result.requestError;
    if (result.source === "usage")
      return `${name}：${result.usageSourceName ? `${result.usageSourceName}の採用データから、メガ後に合法な項目を適用しました` : "採用上位の設定を適用しました"}（項目ごとの統計です）。${updateError ? ` ${updateError}` : ""}`;
    const reason =
      result.reason === "season"
        ? `${result.season ?? "この"}シーズンの統計には未対応です。`
        : result.reason === "species"
          ? "選択フォームと統計の対象が一致しません。"
          : result.reason === "invalid"
            ? "統計データを検証できませんでした。"
            : result.reason === "no-legal-rows"
              ? "有効な採用候補がありません。"
              : result.reason === "unsupported-form"
                ? "対応する通常フォーム統計がありません。"
                : "利用できる採用データがありません。";
    return `${name}：${reason}通常の初期型を設定しました。編集できます。${updateError ? ` ${updateError}` : ""}`;
  }
  function applyPopularSelection(
    build: Build,
    target: BuildSelectionTarget,
    closePicker: boolean,
  ) {
    const targetKey = buildTargetKey(target);
    const ticket = defaultBuildSelection.current.begin(targetKey);
    const pokemonName = getPokemon(build.pokemonId).name;
    const knownForSpecies =
      target === "defense"
        ? (knownBySpecies[build.pokemonId] ?? unknownInfo())
        : undefined;
    const knownBuild =
      target === "defense"
        ? defense.pokemonId === build.pokemonId
          ? defense
          : opponentBuilds.current[build.pokemonId]
        : undefined;
    setDefaultBuildPending(true);
    setToast("採用データを確認中…");
    if (closePicker)
      setPickerStatus("採用データを確認中…選び直しやキャンセルもできます。");
    void resolvePopularBuildSelection(
      defaultBuildSelection.current,
      ticket,
      build.pokemonId,
      loadUsage,
      {
        known: knownForSpecies,
        knownBuild,
        target: targetKey,
        loadIndex: loadUsageIndex,
      },
    ).then((result) => {
      if (!result) return;
      setDefaultBuildPending(false);
      setPickerStatus("");
      applyBuildSelection(target, result.build);
      if (closePicker) setPicker(null);
      setToast(popularSelectionMessage(pokemonName, result));
    });
  }
  function choose(
    build: Build,
    source: "pokemon" | "history" = "pokemon",
    explicitTarget?: BuildSelectionTarget,
  ) {
    const target = explicitTarget ?? pickerTarget();
    if (!target) return;
    if (source === "history") {
      cancelDefaultSelection();
      setPickerStatus("");
      applyBuildSelection(target, build);
      if (!explicitTarget) setPicker(null);
      return;
    }
    applyPopularSelection(build, target, !explicitTarget);
  }
  function chooseSavedPartyBuild(build: Build) {
    const target = pickerTarget();
    if (!target) return;
    cancelDefaultSelection();
    setPickerStatus("");
    applyBuildSelection(target, structuredClone(build));
    setPicker(null);
  }
  function updateAttack(build: Build) {
    cancelDefaultSelection("battle:attack");
    setAttack(build);
    setAttackSelected(true);
  }
  function updateOpponentMove(name: string) {
    cancelDefaultSelection("battle:defense");
    setOpponentMove(name);
  }
  function openPicker(target: NonNullable<typeof picker>) {
    if (typeof target !== "string") markStarterPartyTouched();
    cancelDefaultSelection();
    setPickerStatus("");
    setPreviewPicker(null);
    setPicker(target);
  }
  function closePicker() {
    cancelDefaultSelection();
    setPickerStatus("");
    setPicker(null);
  }
  function openOpponentPreviewPicker(slotIndex: number) {
    cancelDefaultSelection();
    setPreviewPicker(slotIndex);
  }
  function chooseOpponentPreview(slotIndex: number, id: number | null) {
    setOpponents((current) =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot;
        if (id === null) return { id: null, state: "unknown" };
        if (slot.id === id) return slot;
        return { id, state: "unknown" };
      }),
    );
    setPreviewPicker(null);
  }
  function changePartyIndex(index: number) {
    markStarterPartyTouched();
    cancelDefaultSelection();
    setPartyIndex(index);
  }
  function resetBattle() {
    cancelDefaultSelection();
    setPickerStatus("");
    opponentBuilds.current = {};
    setAttack(makeBuild(445));
    setDefenseState(makeBuild(1000));
    setAttackSelected(false);
    setDefenseSelected(false);
    setMove("じしん");
    setHp(100);
    setScreen(false);
    setWeather("なし");
    setTerrain("なし");
    setTrickRoom(false);
    setAttackSide(defaultSide());
    setDefenseExtra(defaultSide());
    setGravity(false);
    setCrit(false);
    setHits(undefined);
    setRecoveryMode("auto");
    setKnownBySpecies({});
    setOpponents(
      Array.from({ length: 6 }, () => ({ id: null, state: "unknown" })),
    );
    setToast("対戦条件と判明情報をリセットしました");
  }
  function viewResults() {
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function saveMatchupToHistory() {
    if (!calculation.damage) return;
    const next = {
      ...saved,
      attackHistory: addHistory(saved.attackHistory, attack),
      defenseHistory: addHistory(saved.defenseHistory, defense),
    };
    if (commitSavedData(next)) {
      setToast("攻守の型を履歴に保存しました");
    }
  }
  function downloadBackup(data: SavedData): boolean {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "battle-note-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      return false;
    }
  }
  function exportSavedData() {
    if (downloadBackup(saved)) {
      setToast("保存済みパーティと攻守の履歴を書き出しました");
    } else {
      setToast("バックアップを書き出せませんでした。もう一度お試しください。");
    }
  }
  function exportPartyDraftBackup() {
    const backup = {
      ...saved,
      parties: saved.parties.map((savedParty, index) =>
        partyDirtyStates[index]
          ? structuredClone(partyDrafts[index])
          : savedParty,
      ),
    };
    if (downloadBackup(backup)) {
      setToast(
        "未保存の編集を含むバックアップを書き出しました。端末には保存されていません。",
      );
    } else {
      setToast("バックアップを書き出せませんでした。もう一度お試しください。");
    }
  }
  function reportPersistenceFailure(reason: "disabled" | "failed") {
    const message =
      reason === "disabled"
        ? "既存データを保護するため端末への上書きを停止しています。現在の編集は書き出して保管してください。有効なバックアップを読み込むと保存を再開します。"
        : "端末に保存できません。ファイルを書き出してバックアップしてください。";
    setStorageError(message);
    setToast(message);
  }
  function commitSavedData(next: SavedData, requireEmpty = false): boolean {
    let result: ReturnType<typeof writeSavedData>;
    try {
      const storage = localStorage;
      if (requireEmpty && storage.getItem(STORAGE_KEY) !== null) {
        starterStorageConflict.current = true;
        setPersistenceAllowed(false);
        setHasPersistedData(true);
        setStorageError(
          "保存データがすでに作成されたため、現在の画面からの上書きを停止しました。再読み込みしてください。",
        );
        setToast("保存データが見つかったため初回選出を適用しませんでした。");
        return false;
      }
      result = writeSavedData(storage, STORAGE_KEY, next, persistenceAllowed);
    } catch {
      result = { ok: false, reason: "failed" };
    }
    if (!result.ok) {
      pendingPersistenceToast.current = "";
      reportPersistenceFailure(result.reason);
      return false;
    }
    prewrittenSavedData.current = next;
    pendingPersistenceToast.current = "";
    setSaved(next);
    setStorageError("");
    setHasPersistedData(true);
    return true;
  }
  function saveCurrentParty() {
    markStarterPartyTouched();
    setPartySaveAttempt(partyIndex);
    if (partyItemWarning) return;
    if (!party.name.trim()) {
      setToast("パーティ名を入力してください");
      return;
    }
    const next = {
      ...saved,
      parties: saved.parties.map((savedParty, index) =>
        index === partyIndex ? structuredClone(party) : savedParty,
      ),
    };
    if (commitSavedData(next)) {
      setPartySaveAttempt(null);
      setStarterPartyStatus("saved");
      setToast(`${party.name}を保存しました`);
    }
  }
  function saveAllPartyDraftsAndExport() {
    markStarterPartyTouched();
    setPartyExportAttempted(true);
    const errors = partySaveErrors(partyDrafts, dirtyPartyIndexes);
    if (errors.length) {
      setToast("保存して書き出す前に、未保存のパーティを確認してください");
      return;
    }
    const next = {
      ...saved,
      parties: saved.parties.map((savedParty, index) =>
        partyDirtyStates[index]
          ? structuredClone(partyDrafts[index])
          : savedParty,
      ),
    };
    if (!commitSavedData(next)) return;
    setPartyExportAttempted(false);
    setPartySaveAttempt(null);
    setStarterPartyStatus("saved");
    if (downloadBackup(next)) {
      setToast("未保存のパーティを保存して、バックアップを書き出しました");
    } else {
      setToast(
        "すべてのパーティを保存しました。書き出しに失敗したため「保存済みを書き出す」をお試しください。",
      );
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    markStarterPartyTouched();
    cancelDefaultSelection();
    setPickerStatus("");
    if (file.size > 1024 * 1024) {
      setToast(
        "ファイルが大きすぎます。1MB以下のバックアップを選択してください。",
      );
      return;
    }
    try {
      const value: unknown = JSON.parse(await file.text());
      const normalized = normalizeSavedData(value);
      if (!normalized) throw new Error();
      cancelDefaultSelection();
      setPendingImport(normalized);
    } catch {
      setToast(
        "読み込めませんでした。BATTLE NOTEの有効なバックアップを選択してください。",
      );
    }
  }
  function navigate(next: AppPage) {
    cancelDefaultSelection();
    setPickerStatus("");
    setPage(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function navigateForGuide(next: AppPage) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function openGuide() {
    guideOriginPage.current = page;
    guideOriginScroll.current = window.scrollY;
    guideReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setGuideOpen(true);
  }
  function closeGuide() {
    const originPage = guideOriginPage.current;
    const originScroll = guideOriginScroll.current;
    setGuideOpen(false);
    setPage(originPage);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: originScroll, behavior: "auto" });
      const returnFocus = guideReturnFocus.current;
      guideReturnFocus.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      else guideButtonRef.current?.focus({ preventScroll: true });
    });
  }
  function showSpeed() {
    navigate("speed");
  }

  return (
    <div
      className={`app-shell ${page === "home" ? "home-theme" : ""} ${showStickySummary ? "has-sticky-summary" : ""}`}
    >
      <header className="site-header" ref={headerRef}>
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("home");
            }}
            aria-label="BATTLE NOTE ホーム"
          >
            <span className="brand-symbol">
              <Icon name="bolt" size={25} />
            </span>
            <span className="brand-wordmark">
              BATTLE<span>NOTE</span>
              <small>ポケモン対戦サポート</small>
            </span>
          </a>
          <nav className="main-nav" aria-label="メインメニュー">
            <button
              className={page === "home" ? "active" : ""}
              aria-current={page === "home" ? "page" : undefined}
              onClick={() => navigate("home")}
            >
              <span>ホーム</span>
            </button>
            <button
              className={page === "battle" ? "active" : ""}
              aria-current={page === "battle" ? "page" : undefined}
              onClick={() => navigate("battle")}
            >
              <Icon name="target" size={18} />
              <span>ダメージ計算</span>
            </button>
            <button
              className={page === "speed" ? "active" : ""}
              aria-current={page === "speed" ? "page" : undefined}
              onClick={showSpeed}
            >
              <Icon name="speed" size={19} />
              <span>すばやさ</span>
            </button>
            <button
              className={page === "party" ? "active" : ""}
              aria-current={page === "party" ? "page" : undefined}
              onClick={() => navigate("party")}
            >
              <Icon name="team" size={18} />
              <span>パーティ</span>
            </button>
          </nav>
          <button
            ref={guideButtonRef}
            className="help-button"
            aria-label="使い方"
            onClick={openGuide}
          >
            <Icon name="info" size={18} />
            <span>使い方</span>
          </button>
        </div>
      </header>
      {page !== "home" && (
        <div className="preview-strip">
          <div>
            <span className="preview-pill">BETA</span>
            <span>
              {page === "speed"
                ? "すばやさ比較：公開データを基に計算"
                : "実計算・採用データに対応 / 非公式ツール"}
            </span>
            <button onClick={() => setHelp(true)}>
              このツールについて
              <Icon name="arrow" size={13} />
            </button>
          </div>
        </div>
      )}
      <main className={page === "home" ? "home-main" : "main-container"}>
        {storageError && (
          <div className="storage-error" role="alert">
            <Icon name="info" />
            {storageError}
            <button className="text-button" onClick={exportSavedData}>
              保存済みを書き出す
            </button>
            {hasUnsavedPartyDrafts && (
              <button
                className="text-button party-backup"
                onClick={exportPartyDraftBackup}
              >
                未保存の編集を含めてバックアップ
              </button>
            )}
          </div>
        )}
        {page !== "home" && (
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                {page === "party" ? "YOUR BATTLE TEAM" : "BATTLE TOOLS"}
                <span className="eyebrow-separator">/</span>SINGLE BATTLE
              </div>
              <h1>
                {page === "battle"
                  ? "ダメージ計算"
                  : page === "speed"
                    ? "すばやさ比較"
                    : "マイパーティ"}
                <span className="title-dot">.</span>
              </h1>
              <p>
                {page === "battle"
                  ? "相手を知って、次の一手を見つけよう。"
                  : page === "speed"
                    ? "このすばやさで、どこまで届く？"
                    : "いつもの6体を、すぐにバトルへ。"}
              </p>
            </div>
            <div className="season-badge">
              <span className="season-icon">
                <Icon name="shield" size={22} />
              </span>
              <span>
                <small>POKÉMON CHAMPIONS</small>
                <strong>
                  シングルバトル <span>シングル対応</span>
                </strong>
              </span>
            </div>
          </div>
        )}
        {page === "home" ? (
          <HomePage navigate={navigate} onHelp={openGuide} />
        ) : page === "battle" ? (
          <>
            <div className="field-toolbar">
              <span className="toolbar-label">バトルの条件</span>
              <label>
                <Icon name="sun" size={17} />
                <span>天候</span>
                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  aria-label="天候"
                >
                  {["なし", "はれ", "あめ", "すなあらし", "ゆき"].map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              <span className="toolbar-divider" />
              <label>
                <Icon name="leaf" size={17} />
                <span>フィールド</span>
                <select
                  value={terrain}
                  onChange={(e) => setTerrain(e.target.value)}
                  aria-label="フィールド"
                >
                  {["なし", "エレキ", "グラス", "ミスト", "サイコ"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <span className="toolbar-divider" />
              <button
                className="trick-switch"
                role="switch"
                aria-checked={trickRoom}
                onClick={() => setTrickRoom(!trickRoom)}
              >
                <span
                  className={`small-switch ${trickRoom ? "enabled" : ""}`}
                />
                トリックルーム
              </button>
              <button className="reset-button" onClick={resetBattle}>
                <Icon name="refresh" size={15} />
                <span>リセット</span>
              </button>
            </div>
            <section className="quick-party">
              <div className="section-heading">
                <h2>
                  <Icon name="team" size={17} />
                  パーティから選ぶ
                </h2>
                <button
                  className="text-button"
                  onClick={() => navigate("party")}
                >
                  管理する
                  <Icon name="arrow" size={14} />
                </button>
              </div>
              <div className="quick-party-content">
                <div
                  className="party-target"
                  role="group"
                  aria-label="パーティの呼び出し先"
                >
                  <button
                    aria-pressed={partyTarget === "attack"}
                    onClick={() => setPartyTarget("attack")}
                  >
                    攻撃側
                  </button>
                  <button
                    aria-pressed={partyTarget === "defense"}
                    onClick={() => setPartyTarget("defense")}
                  >
                    受け側
                  </button>
                </div>
                <select
                  value={partyIndex}
                  onChange={(e) => changePartyIndex(Number(e.target.value))}
                  aria-label="呼び出すパーティ"
                >
                  {saved.parties.map((p, i) => (
                    <option key={i} value={i}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="party-mini-list">
                  {saved.parties[partyIndex].members.map((b, i) =>
                    b ? (
                      <button
                        key={i}
                        onClick={() => {
                          cancelDefaultSelection();
                          if (partyTarget === "attack") {
                            updateAttack(structuredClone(b));
                            setMove(b.moves[0] ?? "");
                          } else {
                            setDefense(structuredClone(b));
                            setOpponentMove(b.moves[0] ?? "");
                          }
                          setToast(
                            `${getPokemon(b.pokemonId).name}を${partyTarget === "attack" ? "攻撃側" : "受け側"}にセットしました`,
                          );
                        }}
                        title={`${getPokemon(b.pokemonId).name}を${partyTarget === "attack" ? "攻撃側" : "受け側"}にセット`}
                        aria-label={`${getPokemon(b.pokemonId).name}を${partyTarget === "attack" ? "攻撃側" : "受け側"}にセット`}
                      >
                        <Picture id={b.pokemonId} item={b.item} />
                      </button>
                    ) : (
                      <button
                        key={i}
                        className="empty-member"
                        onClick={() => {
                          navigate("party");
                          openPicker({ party: partyIndex, member: i });
                        }}
                        aria-label={`パーティの${i + 1}枠目に追加`}
                      >
                        <Icon name="plus" size={18} />
                      </button>
                    ),
                  )}
                </div>
              </div>
            </section>
            <div className="workspace">
              <div className="calculation-column">
                <div className="matchup-grid">
                  <PokemonCard
                    side="attack"
                    build={attack}
                    selected={attackSelected}
                    setBuild={updateAttack}
                    history={saved.attackHistory}
                    pick={() => openPicker("attack")}
                    move={move}
                    setMove={setMove}
                    opponentMove={opponentMove}
                    setOpponentMove={updateOpponentMove}
                    hp={hp}
                    setHp={setHp}
                    sideState={attackSide}
                    onSideChange={setAttackSide}
                  />
                  <button
                    className="swap-button"
                    onClick={() => {
                      cancelDefaultSelection();
                      if (defenseSelected)
                        opponentBuilds.current[defense.pokemonId] =
                          structuredClone(defense);
                      setAttack(defense);
                      setDefenseState(attack);
                      setAttackSelected(defenseSelected);
                      setDefenseSelected(attackSelected);
                      setMove(defense.moves[0] ?? "");
                      setAttackSide(defenseSide);
                      setDefenseExtra(attackSide);
                      setHp(attackSide.hp);
                      setScreen(attackSide.reflect);
                    }}
                    aria-label="攻撃側と受け側を入れ替える"
                    title="攻守を入れ替える"
                  >
                    <Icon name="swap" size={18} />
                  </button>
                  <PokemonCard
                    side="defense"
                    build={defense}
                    selected={defenseSelected}
                    setBuild={setDefense}
                    history={saved.defenseHistory}
                    pick={() => openPicker("defense")}
                    move={move}
                    setMove={setMove}
                    opponentMove={opponentMove}
                    setOpponentMove={updateOpponentMove}
                    hp={hp}
                    setHp={setHp}
                    sideState={defenseSide}
                    onSideChange={updateDefenseSide}
                  />
                </div>
                <section
                  className="live-panel field-panel"
                  aria-label="場の状態"
                >
                  <h2>場の状態</h2>
                  <div className="live-side-grid">
                    <FieldSideControls
                      label="攻撃側"
                      value={attackSide}
                      onChange={setAttackSide}
                    />
                    <FieldSideControls
                      label="受け側"
                      value={defenseSide}
                      onChange={updateDefenseSide}
                    />
                  </div>
                  <div className="live-checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={gravity}
                        onChange={(e) => setGravity(e.target.checked)}
                      />
                      じゅうりょく
                    </label>
                  </div>
                </section>
                <div className="result-actions">
                  <button className="calculate-button" onClick={viewResults}>
                    <Icon name="target" size={19} />
                    <span>結果を見る</span>
                    <Icon name="arrow" size={19} />
                  </button>
                  <button
                    className="history-save-button"
                    onClick={saveMatchupToHistory}
                    disabled={!calculation.damage}
                    title="ポケモン・性格・配分・持ち物・特性・技を保存します。"
                  >
                    <Icon name="clock" size={16} />
                    攻守の型を履歴に保存
                  </button>
                </div>
                <p className="calculation-auto-note">
                  結果は入力に応じて自動更新されます。
                </p>
                <section
                  className="result-card"
                  ref={resultRef}
                  aria-label="ダメージ計算結果"
                >
                  <div className="section-heading">
                    <h2>
                      <span className="section-icon yellow">
                        <Icon name="bolt" size={17} />
                      </span>
                      ダメージの目安
                    </h2>
                  </div>
                  {hasMatchup ? (
                    <DamageView
                      damage={calculation.damage}
                      error={calculation.error}
                      recoveryMode={recoveryMode}
                      onRecoveryModeChange={setRecoveryMode}
                    />
                  ) : (
                    <p className="live-alert">
                      ダメージを見るには、攻撃側と受け側のポケモンを選んでください。
                    </p>
                  )}
                </section>
                <details className="live-details">
                  <summary>HP・状態異常</summary>
                  <div className="live-side-grid">
                    <div>
                      <SideControls
                        label="攻撃側"
                        value={attackSide}
                        onChange={setAttackSide}
                      />
                    </div>
                    <div>
                      <SideControls
                        label="受け側"
                        value={defenseSide}
                        onChange={updateDefenseSide}
                      />
                    </div>
                  </div>
                  <div className="live-checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={crit}
                        onChange={(e) => setCrit(e.target.checked)}
                      />
                      急所
                    </label>
                    <label>
                      連続技の命中回数
                      <select
                        aria-label="連続技の命中回数"
                        value={hits ?? ""}
                        onChange={(e) =>
                          setHits(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      >
                        <option value="">技の標準回数</option>
                        {[1, 2, 3, 4, 5, 10].map((n) => (
                          <option key={n} value={n}>
                            {n}回
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </details>
                {defenseSelected && (
                  <OpponentInfo
                    build={defense}
                    known={known}
                    onKnown={(k) => {
                      cancelDefaultSelection("battle:defense");
                      setKnownBySpecies((current) => ({
                        ...current,
                        [defense.pokemonId]: k,
                      }));
                    }}
                    opponents={opponents}
                    onOpponents={setOpponents}
                    onPickSlot={openOpponentPreviewPicker}
                  />
                )}
                {hasMatchup && (
                  <AssumptionsView
                    {...matchup}
                    known={known}
                    usage={
                      usageCompatible(usage, usageData.index?.data)
                        ? usage
                        : undefined
                    }
                    seasonContext={usageData.index?.data}
                    onApply={setDefense}
                  />
                )}
              </div>
              <aside className="insights-column">
                <section className="speed-card">
                  <div className="section-heading">
                    <h2>
                      <span className="section-icon blue">
                        <Icon name="speed" size={18} />
                      </span>
                      すばやさ比較
                    </h2>
                  </div>
                  {hasMatchup ? (
                    <SpeedView
                      {...matchup}
                      opponentMove={opponentMove}
                      setOpponentMove={setOpponentMove}
                    />
                  ) : (
                    <p className="sidebar-empty">
                      攻撃側と受け側を選ぶと、対面のすばやさを比較できます。
                    </p>
                  )}
                  <button className="speed-card-link" onClick={showSpeed}>
                    全ポケモンとすばやさを比較
                    <Icon name="arrow" size={15} />
                  </button>
                </section>
                <section className="prediction-card">
                  <div className="prediction-header">
                    <span className="eyebrow">READ THE NEXT MOVE</span>
                    <h2>相手の行動候補</h2>
                    <p>警戒したい一手を、根拠とともに。</p>
                  </div>
                  {hasMatchup ? (
                    <PredictionView
                      {...matchup}
                      known={known}
                      usage={usage}
                      season={usageData.index?.data?.season}
                      seasonContext={usageData.index?.data}
                      opponents={predictionOpponents}
                    />
                  ) : (
                    <p className="sidebar-empty">
                      攻撃側と受け側を選ぶと、相手の行動候補を表示します。
                    </p>
                  )}
                </section>
                {defenseSelected && (
                  <UsagePanel
                    data={usageData}
                    build={defense}
                    onSelect={(id) =>
                      choose(makeBuild(id), "pokemon", "defense")
                    }
                  />
                )}
              </aside>
            </div>
          </>
        ) : page === "speed" ? null : (
          <>
            <div className="party-toolbar" data-guide-target="party-settings">
              <div
                className="party-tabs"
                role="tablist"
                aria-label="保存パーティ"
              >
                {partyDrafts.map((p, i) => (
                  <button
                    role="tab"
                    aria-selected={i === partyIndex}
                    key={i}
                    className={`${i === partyIndex ? "selected" : ""} ${partySaveLabels[i] !== "保存済み" ? "has-unsaved" : ""}`}
                    aria-label={`パーティ${i + 1} ${p.name}、${partySaveLabels[i]}、${p.members.filter(Boolean).length}体`}
                    onClick={() => changePartyIndex(i)}
                  >
                    <span>0{i + 1}</span>
                    <span className="party-tab-name">{p.name}</span>
                    <small
                      className={`party-dirty-status ${partySaveLabels[i] !== "保存済み" ? "is-dirty" : "is-saved"}`}
                    >
                      {partySaveLabels[i]}
                    </small>
                    <small>{p.members.filter(Boolean).length}/6</small>
                  </button>
                ))}
              </div>
              <div className="file-actions">
                <button
                  className="secondary-button"
                  onClick={() => fileInput.current?.click()}
                >
                  <Icon name="upload" size={16} />
                  読み込む
                </button>
                <button className="secondary-button" onClick={exportSavedData}>
                  <Icon name="download" size={16} />
                  保存済みを書き出す
                </button>
                {hasUnsavedPartyDrafts && (
                  <button
                    className="primary-button party-save-export"
                    onClick={saveAllPartyDraftsAndExport}
                  >
                    <Icon name="download" size={16} />
                    保存して書き出す
                  </button>
                )}
              </div>
            </div>
            {partyExportErrors.length > 0 && (
              <div className="party-save-error" role="alert">
                <strong>
                  保存して書き出す前に、未保存のパーティを確認してください。
                </strong>
                <ul>
                  {partyExportErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <section className="party-panel">
              <div className="party-panel-heading">
                <div>
                  <label className="party-name-input">
                    <Icon name="edit" size={18} />
                    <input
                      aria-label="パーティ名"
                      maxLength={24}
                      value={party.name}
                      onChange={(e) => {
                        markStarterPartyTouched();
                        setPartyDrafts((d) =>
                          d.map((p, i) =>
                            i === partyIndex
                              ? { ...p, name: e.target.value }
                              : p,
                          ),
                        );
                      }}
                    />
                  </label>
                  <p>
                    各メンバーを選んで編集。パーティは最大3つまで保存できます。
                  </p>
                  <p
                    className={`party-dirty-banner ${partyDirty ? "is-dirty" : "is-saved"}`}
                    role="status"
                  >
                    {partyDirty
                      ? "このパーティには未保存の変更があります。"
                      : hasPersistedData
                        ? "このパーティの変更は保存済みです。"
                        : "このサンプルは端末に未保存です。"}
                  </p>
                </div>
                <span className="party-count">
                  <b>{party.members.filter(Boolean).length}</b> / 6 MEMBERS
                </span>
              </div>
              <div className="party-members">
                {party.members.map((b, i) => (
                  <div
                    className={`party-member ${b ? "" : "unfilled"}`}
                    key={i}
                  >
                    {b ? (
                      <>
                        <span className="member-slot">0{i + 1}</span>
                        <button
                          className="member-picker"
                          onClick={() =>
                            openPicker({ party: partyIndex, member: i })
                          }
                          aria-label={`${i + 1}枠目のポケモンを変更`}
                        >
                          <Picture id={b.pokemonId} item={b.item} />
                          <h3>{pokemonAppearance(b.pokemonId, b.item).name}</h3>
                          <div className="type-list">
                            {pokemonAppearance(b.pokemonId, b.item).types.map(
                              (t) => (
                                <TypeBadge key={t} type={t} />
                              ),
                            )}
                          </div>
                          <span className="member-edit">
                            <Icon name="edit" size={13} />
                            変更
                          </span>
                        </button>
                        <label>
                          もちもの
                          <ItemSelect
                            pokemon={getPokemon(b.pokemonId)}
                            value={b.item}
                            onChange={(item) => {
                              markStarterPartyTouched();
                              setPartyDrafts((d) =>
                                d.map((p, j) =>
                                  j === partyIndex
                                    ? {
                                        ...p,
                                        members: p.members.map((m, k) =>
                                          k === i && m ? { ...m, item } : m,
                                        ),
                                      }
                                    : p,
                                ),
                              );
                            }}
                          />
                        </label>
                        <button
                          className="member-details member-edit-build"
                          onClick={() => {
                            markStarterPartyTouched();
                            setEditingMember({
                              party: partyIndex,
                              member: i,
                              build: b,
                            });
                          }}
                          aria-label={`${getPokemon(b.pokemonId).name}の育成型を編集`}
                        >
                          <span>
                            {b.nature} / {resolveBattleBuild(b).ability}
                          </span>
                          <Icon name="edit" size={12} />
                        </button>
                        <div className="member-points">
                          {b.points.map((v, j) => (
                            <span key={j}>
                              {statShort[j]} <b>{v}</b>
                            </span>
                          ))}
                        </div>
                        <button
                          className="text-button load-member"
                          onClick={() => {
                            cancelDefaultSelection();
                            updateAttack(structuredClone(b));
                            setMove(b.moves[0] ?? "");
                            navigate("battle");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          計算に使う
                          <Icon name="arrow" size={14} />
                        </button>
                        <button
                          className="remove-member"
                          onClick={() => {
                            markStarterPartyTouched();
                            cancelDefaultSelection();
                            setPartyDrafts((d) =>
                              d.map((p, j) =>
                                j === partyIndex
                                  ? {
                                      ...p,
                                      members: p.members.map((m, k) =>
                                        k === i ? null : m,
                                      ),
                                    }
                                  : p,
                              ),
                            );
                          }}
                          aria-label={`${getPokemon(b.pokemonId).name}を編集中のパーティから外す`}
                          title="編集中のパーティから外す"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() =>
                          openPicker({ party: partyIndex, member: i })
                        }
                      >
                        <span className="member-slot">0{i + 1}</span>
                        <span className="add-member-circle">
                          <Icon name="plus" size={26} />
                        </span>
                        <strong>ポケモンを追加</strong>
                        <small>いつもの一体を選ぼう</small>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {partySaveAttempt === partyIndex && partyItemWarning && (
                <p className="party-save-error" role="alert">
                  {partyItemWarning}
                </p>
              )}
              <div className="party-save-row">
                <p>
                  <Icon name="info" size={15} />
                  このブラウザ内に保存されます。端末間の移行には書き出しを使ってください。
                </p>
                <button className="primary-button" onClick={saveCurrentParty}>
                  <Icon name="check" size={18} />
                  このパーティを保存
                </button>
              </div>
            </section>
            <div className="party-tip">
              <Icon name="bolt" size={21} />
              <div>
                <strong>スタンダードパーティ</strong>
                <p>{starterPartyStatusMessage}</p>
                {starterRankingSummary && (
                  <p className="party-ranking-summary">
                    {starterRankingSummary}
                  </p>
                )}
                <p>空き枠のあるパーティも途中保存できます。</p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("battle")}
              >
                計算画面へ
                <Icon name="arrow" size={17} />
              </button>
            </div>
          </>
        )}
        <div hidden={page !== "speed"}>
          <SpeedPage
            attack={attackSelected ? attack : null}
            defense={defenseSelected ? defense : null}
            active={page === "speed"}
            allowAutoLoad={!guideOpen}
          />
        </div>
      </main>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">
            <Icon name="bolt" size={17} />
            BATTLE NOTE
          </span>
          <span>次の一手に、もっと自信を。</span>
        </div>
        <div>
          <button onClick={() => setPalette(true)}>デザインガイド</button>
          <button onClick={() => setHelp(true)}>このツールについて</button>
          <span>非公式ファンツール</span>
        </div>
      </footer>
      {guideOpen && (
        <FirstUseGuide
          page={page}
          onNavigate={navigateForGuide}
          onClose={closeGuide}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {picker && (
        <Picker
          close={closePicker}
          onSelect={choose}
          status={defaultBuildPending ? pickerStatus : undefined}
          history={
            picker === "attack"
              ? saved.attackHistory
              : picker === "defense"
                ? saved.defenseHistory
                : []
          }
          quickParty={
            picker === "attack" || picker === "defense"
              ? saved.parties[partyIndex]
              : undefined
          }
          onQuickPartySelect={chooseSavedPartyBuild}
        />
      )}
      {previewPicker !== null && (
        <Picker
          title={`相手${previewPicker + 1}のポケモンを選ぶ`}
          close={() => setPreviewPicker(null)}
          onSelect={(build) =>
            chooseOpponentPreview(previewPicker, build.pokemonId)
          }
          history={[]}
          noHistory
          excludedIds={opponents.flatMap((slot, index) =>
            index !== previewPicker && slot.id !== null ? [slot.id] : [],
          )}
          onClear={
            opponents[previewPicker].id === null
              ? undefined
              : () => chooseOpponentPreview(previewPicker, null)
          }
        />
      )}
      {editingMember && (
        <MemberEditor
          build={editingMember.build}
          close={() => setEditingMember(null)}
          onSave={(build) => {
            setPartyDrafts((d) =>
              d.map((p, i) =>
                i === editingMember.party
                  ? {
                      ...p,
                      members: p.members.map((b, j) =>
                        j === editingMember.member ? build : b,
                      ),
                    }
                  : p,
              ),
            );
            setEditingMember(null);
            setToast(
              "育成型を反映しました。「パーティを保存」で保存できます。",
            );
          }}
        />
      )}
      {help && (
        <Modal title="このツールについて" close={() => setHelp(false)}>
          <div className="help-content">
            <span className="help-logo">
              <Icon name="bolt" size={30} />
            </span>
            <h3>次の一手を考えるための、バトルノート。</h3>
            <p>
              チャンピオンズ向けのダメージ・すばやさ比較と、相手の行動候補の検討に使えます。ゲーム本体や公式サービスとは接続していません。
            </p>
            <ul className="help-feature-list">
              <li>
                <strong>結果を自動で更新</strong>
                <span>
                  入力した条件で結果は自動更新されます。「結果を見る」は結果への移動、「攻守の型を履歴に保存」はポケモン・技・性格・配分・特性・持ち物の保存です。
                </span>
              </li>
              <li>
                <strong>対戦中の条件を反映</strong>
                <span>
                  残りHP、能力ランク、状態異常、天候、フィールド、壁、急所などを設定できます。
                </span>
              </li>
              <li>
                <strong>すばやさを比較</strong>
                <span>
                  専用ページで、自分とほかのポケモンのすばやさを一覧で比べられます。
                </span>
              </li>
              <li>
                <strong>パーティを保存</strong>
                <span>
                  最大3パーティ（各6体）をこの端末に保存できます。攻撃側・受け側の履歴は各6件まで。JSONファイルでバックアップもできます。
                </span>
              </li>
              <li>
                <strong>採用データを確認</strong>
                <span>
                  非公式の採用データを日本時間で1日1回確認します。今シーズンの項目が不足する場合は前シーズンを参照し、取得に失敗した場合は保存済みデータを使います。
                </span>
              </li>
            </ul>
            <h4>予測と計算の範囲</h4>
            <p>
              行動候補は採用率・ダメージ・行動順に基づくルール評価です。採用率は行動確率ではありません。入力した控えは判明情報を反映して個別に評価します。相手の全6体と選出3体がまだ確定していない場合、こちらの技で相手のHPが半分以上削られそうなときや、ねむり・こおりで動きにくいときに限り、交代先を推測せず「交代（交代先は不明）」も候補にします。型は独立した採用率から組み立てた仮定で、実際の組み合わせを保証しません。
            </p>
            <p>
              命中判定やターン終了時の効果を含む対戦シミュレーターではありません。ばけのかわ等、未計算の効果がある場合は注意と判定保留を表示します。統計は提供元一覧で確認した今シーズンと前シーズンを参照します。計算カタログに未登録の技・特性・もちものは自動候補から除外します。
            </p>
            <p className="credits">
              ポケモン画像：
              <a
                href="https://github.com/PokeAPI/sprites"
                target="_blank"
                rel="noreferrer"
              >
                PokeAPI / sprites
              </a>
              {" / "}
              <a
                href="https://archives.bulbagarden.net/wiki/Category:Vivillon"
                target="_blank"
                rel="noreferrer"
              >
                Bulbagarden Archives（ビビヨン）
              </a>
              {" / "}
              <a
                href="https://pokemondb.net/artwork/mimikyu"
                target="_blank"
                rel="noreferrer"
              >
                Pokémon Database（ミミッキュ）
              </a>
              <br />
              ポケモンに関する権利は各権利者に帰属します。本ツールは非公式です。
            </p>
          </div>
        </Modal>
      )}
      {palette && (
        <Modal
          title="DESIGN GUIDE — 白いバトルスタジアム"
          close={() => setPalette(false)}
          wide
        >
          <p className="guide-intro">
            清潔・快活・精密。白い余白に、バトルの楽しさを。
          </p>
          <div className="palette-grid">
            {[
              ["WHITE", "#FFFFFF"],
              ["ICE GRAY", "#F4F7FB"],
              ["NAVY", "#18243B"],
              ["BATTLE BLUE", "#245BDB"],
              ["YELLOW", "#FFCB32"],
              ["BATTLE RED", "#D93646"],
              ["GREEN", "#16845B"],
              ["SLATE", "#5E6B80"],
            ].map(([n, c]) => (
              <div key={n}>
                <div className="color-swatch" style={{ background: c }} />
                <strong>{n}</strong>
                <code>{c}</code>
              </div>
            ))}
          </div>
          <div className="guide-type">
            <div>
              <span>TYPOGRAPHY</span>
              <h3>
                相手を知って、
                <br />
                次の一手を。
              </h3>
              <p>明快なゴシック体。余白と太さで情報を整理。</p>
            </div>
            <div>
              <span>NUMERALS</span>
              <strong>
                78.4<small>%</small>
              </strong>
              <p>重要な数値は大きく、桁を揃えて。</p>
            </div>
          </div>
          <div className="guide-components">
            <button
              className="primary-button"
              onClick={() => setPalette(false)}
            >
              ブルーの主操作
              <Icon name="arrow" size={16} />
            </button>
            <TypeBadge type="dragon" />
            <TypeBadge type="ground" />
          </div>
        </Modal>
      )}
      {pendingImport && (
        <Modal
          title="バックアップを読み込みますか？"
          close={() => setPendingImport(null)}
        >
          <div className="import-confirm">
            <Icon name="upload" size={30} />
            <p>
              保存済みの3パーティと攻守の履歴を、このファイルの内容で置き換えます。編集中のパーティも置き換わります。
            </p>
            <ul>
              {pendingImport.parties.map((p, i) => (
                <li key={i}>
                  {p.name}
                  <span>{p.members.filter(Boolean).length}体</span>
                </li>
              ))}
            </ul>
            <div>
              <button
                className="secondary-button"
                onClick={() => setPendingImport(null)}
              >
                キャンセル
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  cancelDefaultSelection();
                  setPickerStatus("");
                  setPersistenceAllowed(true);
                  pendingPersistenceToast.current =
                    "バックアップを読み込みました";
                  setSaved(pendingImport);
                  const importedParties = structuredClone(
                    pendingImport.parties,
                  );
                  partyDraftsRef.current = importedParties;
                  setPartyDrafts(importedParties);
                  setStarterPartyStatus("saved");
                  setPendingImport(null);
                }}
              >
                置き換えて読み込む
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showStickySummary && (
        <StickyDamageSummary
          damage={calculation.damage}
          repeatedKO={calculation.repeatedKO}
          error={calculation.error}
        />
      )}
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Icon name="info" size={18} />
            <span>{toast}</span>
            <button onClick={() => setToast("")} aria-label="通知を閉じる">
              <Icon name="close" size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
