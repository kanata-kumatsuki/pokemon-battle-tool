import type { RecoveryMode } from "./item-recovery";
import type { RepeatedKOResult } from "./item-recovery";
import { useState } from "react";
import { useBattleUsage } from "./useBattleUsage";
export { useBattleUsage } from "./useBattleUsage";
import {
  getPokemon,
  usageSourcePokemon,
  getNatureModifier,
  statLabels,
  pokemonAppearance,
  resolveBattleBuild,
  pokemon,
  moveByName,
  learnableMoves,
  abilityCatalog,
  itemCatalog,
  englishNatures,
  statShort,
  supportedSeason,
  type Build,
} from "./data";
import {
  damageFor,
  actionOrder,
  type SideState,
  type BattleField,
  type DamageResult,
} from "./battle";
import {
  japanDay,
  usageCompatible,
  type UsageSeasonContext,
  type UsageSnapshot,
} from "./usage";
import {
  assumptions,
  predictActions,
  type KnownInfo,
  type OpponentSlot,
} from "./predictions";
import "./battle.css";
import { MoveSelect } from "./MoveSelect";
export function MoveSlots({
  build,
  onChange,
}: {
  build: Build;
  onChange: (b: Build) => void;
}) {
  const moves = learnableMoves(getPokemon(build.pokemonId));
  return (
    <div className="move-slots">
      {Array.from({ length: 4 }, (_, i) => (
        <div className="move-slot" key={i}>
          <span>わざ {i + 1}</span>
          <MoveSelect
            label={`わざ${i + 1}を編集`}
            value={build.moves[i] ?? ""}
            choices={moves.filter(
              ([name]) =>
                name === build.moves[i] || !build.moves.includes(name),
            )}
            onChange={(name) => {
              const next = [...build.moves];
              next[i] = name;
              onChange({ ...build, moves: next.filter(Boolean) });
            }}
          />
        </div>
      ))}
    </div>
  );
}
export function SideControls({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SideState;
  onChange: (s: SideState) => void;
}) {
  return (
    <div className="live-side-controls">
      <h3>{label}</h3>
      <label>
        残りHP{" "}
        <input
          aria-label={`${label}の詳細HP`}
          type="number"
          min={1}
          max={100}
          value={value.hp}
          onChange={(e) =>
            onChange({
              ...value,
              hp: Math.max(
                1,
                Math.min(100, Math.floor(Number(e.target.value) || 1)),
              ),
            })
          }
        />{" "}
        %
      </label>
      <label>
        状態異常
        <select
          aria-label={`${label}の状態異常`}
          value={value.status}
          onChange={(e) =>
            onChange({
              ...value,
              status: e.target.value as SideState["status"],
            })
          }
        >
          {[
            ["", "なし"],
            ["brn", "やけど"],
            ["par", "まひ"],
            ["psn", "どく"],
            ["tox", "もうどく"],
            ["slp", "ねむり"],
            ["frz", "こおり"],
          ].map(([v, n]) => (
            <option value={v} key={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function RankControls({
  label,
  value,
  onChange,
  dataGuideTarget,
}: {
  label: string;
  value: SideState;
  onChange: (s: SideState) => void;
  dataGuideTarget?: string;
}) {
  return (
    <div className="card-ranks" data-guide-target={dataGuideTarget}>
      <h3>能力ランク</h3>
      <div className="live-ranks">
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i}>
            <span className="rank-caption">
              <span>{statShort[i]}</span>
              <span className="rank-caption-suffix">ランク</span>
            </span>
            <select
              aria-label={`${label}の${statShort[i]}ランク`}
              className={
                value.boosts[i] > 0
                  ? "rank-positive"
                  : value.boosts[i] < 0
                    ? "rank-negative"
                    : ""
              }
              value={value.boosts[i]}
              onChange={(e) => {
                const boosts = [...value.boosts];
                boosts[i] = Number(e.target.value);
                onChange({ ...value, boosts });
              }}
            >
              {Array.from({ length: 13 }, (_, n) => 6 - n).map((n) => (
                <option value={n} key={n}>
                  {n > 0 ? `+${n}` : n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
export function FieldSideControls({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SideState;
  onChange: (s: SideState) => void;
}) {
  return (
    <div
      className="live-side-controls"
      role="group"
      aria-label={`${label}の場の状態`}
    >
      <h3>{label}</h3>
      <div className="live-checks">
        {(
          [
            ["abilityOn", "条件付き特性が発動中"],
            ["tailwind", "おいかぜ"],
            ["reflect", "リフレクター"],
            ["lightScreen", "ひかりのかべ"],
            ["protected", "まもる"],
          ] as const
        ).map(([key, text]) => (
          <label key={key}>
            <input
              type="checkbox"
              aria-label={`${label}の${text}`}
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}
export type MatchupProps = {
  attack: Build;
  defense: Build;
  move: string;
  attackSide: SideState;
  defenseSide: SideState;
  field: BattleField;
  crit?: boolean;
  hits?: number;
  recoveryMode?: RecoveryMode;
};

function DamageBar({
  damage,
  compact = false,
}: {
  damage: DamageResult;
  compact?: boolean;
}) {
  const remainingPercent = (damage.currentHP / damage.maxHP) * 100;
  return (
    <div
      className={`damage-bar${compact ? " sticky-damage-bar" : ""}`}
      aria-label="攻撃後のHP：緑は残りHP、黄は今回のダメージ、灰色は既に減ったHP"
    >
      <div
        className="damage-prior"
        style={{ width: `${100 - remainingPercent}%` }}
      />
      <div
        className="damage-solid"
        style={{ width: `${Math.min(remainingPercent, damage.minPercent)}%` }}
      />
      <div
        className="damage-variable"
        style={{
          width: `${Math.min(remainingPercent, damage.maxPercent) - Math.min(remainingPercent, damage.minPercent)}%`,
        }}
      />
    </div>
  );
}

export function DamageView({
  damage,
  error,
  recoveryMode = "auto",
  onRecoveryModeChange,
}: {
  damage: DamageResult | null;
  error?: string;
  recoveryMode?: RecoveryMode;
  onRecoveryModeChange: (mode: RecoveryMode) => void;
}) {
  if (!damage)
    return (
      <p role="alert" className="live-alert">
        {error ?? "この条件では計算できません"}
      </p>
    );
  const ko = damage.koChance;
  const remainingPercent = (damage.currentHP / damage.maxHP) * 100;
  return (
    <>
      <div
        className="recovery-controls"
        role="group"
        aria-label="相手の回復アイテムの計算"
      >
        <span>相手のアイテム回復</span>
        <div>
          <button
            aria-pressed={recoveryMode !== "none"}
            onClick={() => onRecoveryModeChange("auto")}
          >
            回復を含める
          </button>
          <button
            aria-pressed={recoveryMode === "none"}
            onClick={() => onRecoveryModeChange("none")}
          >
            回復なし
          </button>
        </div>
      </div>
      <div className="result-summary">
        <div>
          <p className="damage-result-label">
            技が与えるダメージ（相手の最大HPに対する割合）
          </p>
          <div className="result-number">
            {damage.minPercent.toFixed(1)}
            <span>〜</span>
            {damage.maxPercent.toFixed(1)}
            <small>%</small>
          </div>
          <p>
            {damage.min} 〜 {damage.max} ダメージ{" "}
            <span>
              / 最大HP {damage.maxHP}・残り {damage.currentHP}
            </span>
          </p>
        </div>
        <div className="ko-badge">
          <strong>
            {damage.statusMove
              ? "変化技"
              : ko === null
                ? "判定保留"
                : ko === 100
                  ? "確定1発"
                  : ko === 0
                    ? "一撃不可"
                    : "乱数1発"}
          </strong>
          <small>一撃撃破 {ko === null ? "—" : `${ko.toFixed(1)}%`}</small>
        </div>
      </div>
      <DamageBar damage={damage} />
      <div className="damage-axis">
        <span>100%</span>
        <span className="damage-legend">
          <i />
          確定ダメージ <i />
          乱数幅
          {remainingPercent < 100 && (
            <>
              {" "}
              <i className="prior-legend" />
              既に減ったHP
            </>
          )}
        </span>
        <span>0%</span>
      </div>
      <RecoverySummary damage={damage} mode={recoveryMode} />
      <p className="result-disclaimer">
        命中時のダメージ。上のバーは回復前です。下の残りHPはアイテム回復
        {recoveryMode === "none"
          ? "なし"
          : "を含みます（たべのこしはターン終了時1回）"}
        。その他のターン終了時効果・相手の行動は含みません。
      </p>
      {damage.notes.map((n) => (
        <p className="live-alert" key={n}>
          {n}
        </p>
      ))}
    </>
  );
}

export function StickyDamageSummary({
  damage,
  repeatedKO,
  error,
}: {
  damage: DamageResult | null;
  repeatedKO: RepeatedKOResult | null;
  error?: string;
}) {
  const count = () => {
    if (!damage) return "—";
    if (damage.statusMove) return "対象外";
    if (damage.koChance === null || !repeatedKO) return "判定保留";
    if (repeatedKO.alreadyKnockedOut) return "撃破済み";
    if (repeatedKO.impossible) return "撃破不可";
    if (repeatedKO.firstKOUse === null)
      return `${repeatedKO.useLimit}回以内なし`;
    if (repeatedKO.guaranteedKOUse === repeatedKO.firstKOUse)
      return `${repeatedKO.firstKOUse}回`;
    if (repeatedKO.guaranteedKOUse !== null)
      return `${repeatedKO.firstKOUse}〜${repeatedKO.guaranteedKOUse}回`;
    return `最短${repeatedKO.firstKOUse}回`;
  };
  const probability = () => {
    if (!damage) return "—";
    if (damage.statusMove) return "対象外";
    if (damage.koChance === null || !repeatedKO) return "判定保留";
    if (repeatedKO.alreadyKnockedOut) return "100%";
    if (repeatedKO.impossible) return "0%";
    const chance = repeatedKO.chanceByFirstKO ?? repeatedKO.chanceByLimit;
    const certain =
      repeatedKO.guaranteedKOUse !== null &&
      repeatedKO.guaranteedKOUse === repeatedKO.firstKOUse;
    if (certain) return "100%";
    const rounded = Math.round(chance * 10) / 10;
    if (chance > 0 && rounded === 0) return "0.1%未満";
    return rounded >= 100 ? "99.9%+" : `${rounded.toFixed(1)}%`;
  };
  const probabilityLabel =
    damage?.statusMove || damage?.koChance === null
      ? "KO率"
      : repeatedKO?.firstKOUse !== null && repeatedKO?.firstKOUse !== undefined
        ? `${repeatedKO.firstKOUse}回以内の撃破確率`
        : repeatedKO
          ? `${repeatedKO.useLimit}回以内の撃破確率`
          : "KO率";
  const countHint = !damage
    ? error
      ? "条件を確認"
      : ""
    : damage.statusMove
      ? "変化技"
      : damage.koChance === null
        ? "未対応条件あり"
        : repeatedKO?.impossible
          ? "同条件で反復"
          : repeatedKO?.firstKOUse === null
            ? "さらに先は未計算"
            : repeatedKO?.guaranteedKOUse === null
              ? `${repeatedKO?.useLimit ?? 10}回以内で未確定`
              : "同条件で同技を反復";
  return (
    <aside
      className="sticky-damage-summary"
      aria-label="ダメージのコンパクト表示。同じ技を同じ条件で最大10回使う目安です"
    >
      <div className="sticky-damage-summary-inner">
        <div className="sticky-damage-metric">
          <span>与えるダメージ</span>
          <strong>
            {damage
              ? damage.statusMove
                ? "変化技"
                : `${damage.minPercent.toFixed(1)}〜${damage.maxPercent.toFixed(1)}%`
              : "—"}
          </strong>
          {damage && !damage.statusMove && (
            <DamageBar damage={damage} compact />
          )}
        </div>
        <div className="sticky-damage-metric">
          <span>撃破の目安（同技）</span>
          <strong>{count()}</strong>
          <small>{countHint}</small>
        </div>
        <div className="sticky-damage-metric">
          <span>{probabilityLabel}</span>
          <strong>{probability()}</strong>
        </div>
      </div>
    </aside>
  );
}

function RecoverySummary({
  damage,
  mode,
  compact = false,
}: {
  damage: ReturnType<typeof damageFor>;
  mode: RecoveryMode;
  compact?: boolean;
}) {
  const r = damage.recovery;
  if (damage.koChance === null)
    return (
      <p className="live-alert">
        未計算の防御効果があるため、回復後の残りHPは判定保留です。
      </p>
    );
  const percent = (hp: number) => ((hp / damage.maxHP) * 100).toFixed(1);
  const range = (min: number, max: number) =>
    min === max ? String(min) : `${min}〜${max}`;
  return (
    <div className={`recovery-summary ${compact ? "compact" : ""}`}>
      <span className="recovery-heading">
        {mode === "none"
          ? "攻撃後の残りHP（回復なし）"
          : "アイテム回復を含む残りHP"}
      </span>
      <strong>
        {percent(r.minHP)}〜{percent(r.maxHP)}
        <small>%</small>
      </strong>
      <span>
        {range(r.minHP, r.maxHP)} / {damage.maxHP} HP ・ 回復量{" "}
        {range(r.minHealed, r.maxHealed)} HP
      </span>
      <div
        className="remaining-hp-track"
        aria-label={`残りHP ${range(r.minHP, r.maxHP)}`}
      >
        <i style={{ width: `${percent(r.minHP)}%` }} />
        <i
          style={{ width: `${((r.maxHP - r.minHP) / damage.maxHP) * 100}%` }}
        />
      </div>
      {!compact && r.notes.map((note) => <p key={note}>{note}</p>)}
      {compact && <small>回復設定は上のダメージ結果と共通です。</small>}
    </div>
  );
}

export function SpeedView(
  props: MatchupProps & {
    opponentMove: string;
    setOpponentMove: (name: string) => void;
  },
) {
  let result;
  try {
    result = actionOrder(
      props.attack,
      props.defense,
      props.move,
      props.opponentMove,
      props.attackSide,
      props.defenseSide,
      props.field,
    );
  } catch (e) {
    return (
      <p className="live-alert">
        {e instanceof Error ? e.message : "行動順を計算できません"}
      </p>
    );
  }
  const values = [result.attackSpeed, result.defenseSpeed],
    maximum = Math.max(...values, 1);
  return (
    <>
      <div className="speed-race">
        {[props.attack, props.defense].map((b, i) => (
          <div key={i}>
            <span>
              {pokemonAppearance(b.pokemonId, b.item).name}
              <strong>{values[i]}</strong>
            </span>
            <div className="speed-track">
              <span
                style={{ width: `${(values[i] / maximum) * 100}%` }}
                className={i === 0 ? "attack-speed" : "defense-speed"}
              />
            </div>
          </div>
        ))}
      </div>
      <label className="live-label">
        相手の使用技（行動順の仮定）
        <select
          value={props.opponentMove}
          onChange={(e) => props.setOpponentMove(e.target.value)}
          aria-label="相手の行動順確認用の技"
        >
          {learnableMoves(getPokemon(props.defense.pokemonId)).map(([n]) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <div className="speed-verdict">
        <strong>
          {result.first === "tie"
            ? "同速・順番はランダム"
            : result.first === "unknown"
              ? "先手は未確定"
              : `${getPokemon(resolveBattleBuild(result.first === "attack" ? props.attack : props.defense).pokemonId).name}が先手`}
        </strong>
      </div>
      <p className="sidebar-note">
        {result.reason}。優先度 {result.attackPriority} /{" "}
        {result.defensePriority}
      </p>
    </>
  );
}
export function OpponentInfo({
  build,
  known,
  onKnown,
  opponents,
  onOpponents,
  onPickSlot,
}: {
  build: Build;
  known: KnownInfo;
  onKnown: (k: KnownInfo) => void;
  opponents: OpponentSlot[];
  onOpponents: (p: OpponentSlot[]) => void;
  onPickSlot: (index: number) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 700px)").matches,
  );
  return (
    <details
      className="live-details"
      open={detailsOpen}
      onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
    >
      <summary>相手の判明情報・見せ合い6体</summary>
      <p>
        チェックした項目は確定情報として固定します。チェックなしの入力値は計算上の仮定です。
      </p>
      <div className="live-checks">
        {(["ability", "item", "nature", "points"] as const).map((key, i) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={known[key]}
              onChange={(e) => onKnown({ ...known, [key]: e.target.checked })}
            />
            {["特性", "もちもの", "性格", "配分"][i]}が判明
          </label>
        ))}
      </div>
      <label className="live-label">
        判明済みの技を追加（最大4技）
        <select
          aria-label="相手の判明済み技を追加"
          value=""
          disabled={known.moves.length >= 4}
          onChange={(e) =>
            e.target.value &&
            onKnown({ ...known, moves: [...known.moves, e.target.value] })
          }
        >
          <option value="">技を選ぶ</option>
          {learnableMoves(getPokemon(build.pokemonId))
            .filter(([n]) => !known.moves.includes(n))
            .map(([n]) => (
              <option key={n}>{n}</option>
            ))}
        </select>
      </label>
      <div className="known-moves">
        {known.moves.map((n) => (
          <button
            key={n}
            onClick={() =>
              onKnown({ ...known, moves: known.moves.filter((m) => m !== n) })
            }
          >
            {n} ×
          </button>
        ))}
      </div>
      <div className="opponent-slots">
        {opponents.map((slot, i) => (
          <div key={i}>
            <span className="opponent-slot-label">相手 {i + 1}</span>
            <button
              className="opponent-pokemon-button"
              aria-haspopup="dialog"
              aria-label={
                slot.id === null
                  ? `相手${i + 1}のポケモンを選ぶ`
                  : `相手${i + 1}のポケモン${getPokemon(slot.id).name}を変更`
              }
              onClick={() => onPickSlot(i)}
            >
              <span>
                {slot.id === null ? "ポケモンを選ぶ" : getPokemon(slot.id).name}
              </span>
              {slot.id !== null && <small>変更</small>}
            </button>
            <select
              aria-label={`相手${i + 1}の選出状態`}
              value={slot.state}
              onChange={(e) =>
                onOpponents(
                  opponents.map((s, j) =>
                    j === i
                      ? { ...s, state: e.target.value as OpponentSlot["state"] }
                      : s,
                  ),
                )
              }
            >
              <option value="unknown">選出不明</option>
              <option value="selected">選出確認</option>
              <option value="fainted">ひんし</option>
            </select>
          </div>
        ))}
      </div>
    </details>
  );
}
export function AssumptionsView(
  props: MatchupProps & {
    known: KnownInfo;
    usage?: UsageSnapshot;
    seasonContext?: UsageSeasonContext;
    onApply: (b: Build) => void;
  },
) {
  const variants = assumptions(
    props.defense,
    props.known,
    props.usage,
    props.seasonContext,
  );
  const [detailsOpen, setDetailsOpen] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 700px)").matches,
  );
  return (
    <details
      className="live-panel live-details"
      open={detailsOpen}
      onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
    >
      <summary>相手の型を比較</summary>
      <p>型を切り替えて、ダメージとすばやさの違いを確認できます。</p>
      <div className="assumption-grid">
        {variants.map((v) => {
          let result;
          try {
            result = damageFor(
              props.attack,
              v.build,
              props.move,
              props.attackSide,
              props.defenseSide,
              props.field,
              props.crit,
              props.hits,
              props.recoveryMode,
            );
          } catch {
            /* Display unsupported instead of fabricated values. */
          }
          return (
            <article key={v.label}>
              <h3>{v.label}</h3>
              <dl className="assumption-build-facts">
                <div className="fact-nature">
                  <dt>せいかく</dt>
                  <dd>{v.build.nature}</dd>
                </div>
                <div className="fact-item">
                  <dt>もちもの</dt>
                  <dd>{v.build.item}</dd>
                </div>
                <div className="fact-ability">
                  <dt>とくせい</dt>
                  <dd>{resolveBattleBuild(v.build).ability}</dd>
                </div>
              </dl>
              <div className="assumption-points" aria-label="能力ポイント配分">
                {v.build.points.map((n, i) => {
                  const modifier = getNatureModifier(v.build.nature, i);
                  return (
                    <span
                      className={`nature-${modifier}`}
                      key={i}
                      aria-label={`${statLabels[i]} ${n}ポイント${modifier === "up" ? " 性格上昇補正" : modifier === "down" ? " 性格下降補正" : ""}`}
                    >
                      <small>
                        {statShort[i]}
                        {modifier === "up"
                          ? "↑"
                          : modifier === "down"
                            ? "↓"
                            : ""}
                      </small>
                      <b>{n}</b>
                    </span>
                  );
                })}
              </div>
              <div className="assumption-damage">
                <span>こちらの「{props.move}」で与えるダメージ</span>
                <strong>
                  {result
                    ? `${result.minPercent.toFixed(1)}〜${result.maxPercent.toFixed(1)}%`
                    : "計算未対応"}
                </strong>
                <small>
                  {result
                    ? `${result.min}〜${result.max}ダメージ / 相手の最大HP ${result.maxHP}`
                    : ""}
                </small>
              </div>
              {result && (
                <RecoverySummary
                  damage={result}
                  mode={props.recoveryMode ?? "auto"}
                  compact
                />
              )}

              <span>相手のすばやさ {result?.defenseSpeed ?? "—"}</span>
              <p>{v.notes.join("。")}</p>
              <button
                className="secondary-button"
                onClick={() => props.onApply(v.build)}
              >
                この仮定で計算
              </button>
            </article>
          );
        })}
      </div>
    </details>
  );
}
export function PredictionView(
  props: MatchupProps & {
    known: KnownInfo;
    usage?: UsageSnapshot;
    season?: string;
    seasonContext?: UsageSeasonContext;
    opponents: OpponentSlot[];
  },
) {
  const { candidates, warnings } = predictActions(props);
  return (
    <>
      <div className="prediction-list">
        {candidates.map((c, i) => (
          <div
            className={`prediction-item ${i === 0 ? "first" : ""}`}
            key={c.key}
          >
            <span className="rank">0{i + 1}</span>
            <div>
              <div className="prediction-title">
                <strong>{c.name}</strong>
                <span className="action-tag">{c.kind}</span>
              </div>
              {c.reasons.map((r) => (
                <p key={r}>{r}</p>
              ))}
              <details>
                <summary>計算の前提</summary>
                <p>{c.assumptions.join("。")}</p>
              </details>
            </div>
          </div>
        ))}
      </div>
      {!candidates.length && (
        <p className="sidebar-empty">
          現在の情報から評価できる候補がありません。判明技または相手の控えを入力してください。
        </p>
      )}
      <div className="prediction-note">
        <div>
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <p>
            採用率と対面への有効性からの候補順位です。相手が選ぶ確率ではありません。
          </p>
          <details>
            <summary>1位候補の選び方</summary>
            <p>
              技は採用率20%以上、または判明済みのものを優先します。割合が未提供なら採用順位上位4技を対象とします。交代・変化技も状況に応じて評価します。
            </p>
          </details>
        </div>
      </div>
    </>
  );
}
function rowName(category: string, name: string) {
  if (category === "move") return moveByName(name)?.name ?? name;
  if (category === "ability")
    return (
      Object.values(abilityCatalog).find((a) => a.englishName === name)?.name ??
      name
    );
  if (category === "held_item")
    return (
      Object.values(itemCatalog).find((a) => a.englishName === name)?.name ??
      name
    );
  if (category === "stat_alignment")
    return (
      Object.entries(englishNatures).find(([, en]) => en === name)?.[0] ?? name
    );
  return name;
}
export function UsagePanel({
  data,
  build,
  onSelect,
}: {
  data: ReturnType<typeof useBattleUsage>;
  build: Build;
  onSelect: (id: number) => void;
}) {
  const usage = data.entry?.data;
  const selectedPokemon = getPokemon(build.pokemonId);
  const usagePokemon = usageSourcePokemon(selectedPokemon.id);
  const usesPreMegaStats =
    selectedPokemon.mega &&
    usagePokemon &&
    usagePokemon.id !== selectedPokemon.id;
  const seasonContext = data.index?.data;
  return (
    <section className="live-panel usage-panel">
      <div className="section-heading">
        <h2>シングルの採用データ</h2>
        <button
          className="text-button"
          disabled={data.loading}
          onClick={data.retry}
        >
          {data.loading ? "確認中…" : "更新を再試行"}
        </button>
      </div>
      <p>
        <a
          href="https://championsbattledata.com/api_guide"
          target="_blank"
          rel="noreferrer"
        >
          Battle data provided by Pokémon Champions Battle Data
        </a>
      </p>
      <p>
        日本時間で当日の初回利用時に確認。詳細はポケモンを選んだ時に取得します。
      </p>
      {selectedPokemon.mega && (
        <p>
          {usagePokemon
            ? `採用データはメガシンカ前の${usagePokemon.name}由来です。自動初期型はメガ後に合法な候補だけを適用します。`
            : "このメガフォームに対応する通常フォーム統計はありません。"}
        </p>
      )}
      {data.index?.data && (
        <p>
          一覧：{data.index.data.season} / {data.index.data.date}
          。順位のみ提供される場合、使用率%には変換しません。
        </p>
      )}
      {usage && (
        <p>
          {selectedPokemon.name}：
          {usesPreMegaStats ? `${usagePokemon?.name}の統計` : usage.season}
          {usesPreMegaStats ? ` / ${usage.season}` : ""} / データ日付{" "}
          {usage.date}
          <br />
          最終取得成功：
          {data.entry?.checkedAt
            ? new Date(data.entry.checkedAt).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })
            : "—"}
          （日本時間）
        </p>
      )}
      {seasonContext && seasonContext.season !== supportedSeason && (
        <p>
          計算カタログは{supportedSeason}
          です。未登録の技・特性・もちものは候補から除外します。
        </p>
      )}
      {usage && usage.date < japanDay() && (
        <p className="live-alert">提供元のデータは本日より前の日付です。</p>
      )}
      {data.index?.error && (
        <p role="status" className="live-alert">
          {data.index.error}
        </p>
      )}
      {data.entry?.error && (
        <p role="status" className="live-alert">
          {data.entry.error}
        </p>
      )}
      {usage && !usageCompatible(usage, seasonContext) && (
        <p role="alert" className="live-alert">
          このシーズンには未対応です。統計は表示しますが自動予測への適用を停止しています。
        </p>
      )}
      <details>
        <summary>使用順位から相手を選ぶ</summary>
        <select
          aria-label="使用順位から受け側を選択"
          value=""
          onChange={(e) => e.target.value && onSelect(Number(e.target.value))}
        >
          <option value="">ポケモンを選ぶ</option>
          {data.index?.data?.pokemon.map((row) => {
            const p = pokemon.find((p) => !p.mega && p.speciesId === row.id);
            return p ? (
              <option key={row.id} value={p.id}>
                {row.rank ?? "—"}位 {p.name}
              </option>
            ) : null;
          })}
        </select>
      </details>
      {usage && (
        <details>
          <summary>技・特性・もちもの・性格・配分の採用率</summary>
          {[
            "move",
            "ability",
            "held_item",
            "stat_alignment",
            "stat_points",
          ].map((category, i) => (
            <div key={category}>
              <h3>
                {
                  ["わざ", "とくせい", "もちもの", "せいかく", "能力ポイント"][
                    i
                  ]
                }
              </h3>
              {usesPreMegaStats && category === "held_item" && (
                <p>
                  これは通常フォームの持ち物統計です。メガフォームの初期型には適用されません。
                </p>
              )}
              <ol className="usage-rows">
                {usage.rows
                  .filter((r) => r.category === category)
                  .map((r) => (
                    <li key={r.rank}>
                      <span>
                        {r.points
                          ? r.points
                              .map((n, i) => `${statShort[i]}${n}`)
                              .join(" ")
                          : rowName(category, r.name)}
                      </span>
                      <b>{r.percent === null ? "割合なし" : `${r.percent}%`}</b>
                    </li>
                  ))}
              </ol>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
