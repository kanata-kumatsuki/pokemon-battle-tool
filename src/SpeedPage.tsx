import { useLayoutEffect, useMemo, useRef, useState } from "react";
import rosterData from "./generated/speed-roster.json";
import {
  artwork,
  getNatureModifier,
  getPokemon,
  resolveBattleBuild,
  type Build,
  typeNames,
} from "./data";
import {
  calculateSpeed,
  compareSpeedBuilds,
  normalizePokemonSearch,
  speedPresets,
  speedAbilities,
  availableSpeedAbilities,
  resolveSpeedConfig,
  type SpeedAbility,
  type SpeedConfig,
  type SpeedPreset,
  type SpeedPresetFilter,
  type SpeedStageFilter,
  type SpeedSpecies,
} from "./speed";
import "./speed.css";
import { PointInput } from "./PointInput";

const roster: SpeedSpecies[] = rosterData.pokemon;
const comparisonAbilities = (
  Object.keys(speedAbilities) as SpeedAbility[]
).filter(
  (key) =>
    key === "none" ||
    roster.some((p) => availableSpeedAbilities(p).includes(key)),
);
const extraTypes: Record<string, string> = {
  rock: "いわ",
  fighting: "かくとう",
  ice: "こおり",
};
function Types({ types }: { types: string[] }) {
  return (
    <span className="speed-types">
      {types.map((type) => (
        <span className={`type-badge type-${type}`} key={type}>
          {typeNames[type] ?? extraTypes[type] ?? type}
        </span>
      ))}
    </span>
  );
}
function findSpecies(build: Build) {
  build = resolveBattleBuild(build);
  if (build.pokemonId === 10009)
    return roster.find((p) => p.id === "rotomwash")!;
  return (
    roster.find((p) => p.name === getPokemon(build.pokemonId).name) ??
    roster.find((p) => p.number === build.pokemonId) ??
    roster.find((p) => p.id === "garchomp")!
  );
}
function configFromBuild(build: Build): SpeedConfig {
  return {
    points: build.points[5],
    nature: getNatureModifier(build.nature, 5),
    scarf: build.item === "こだわりスカーフ",
    stage: 0,
  };
}

export function SpeedPage({
  attack,
  defense,
  active = true,
  allowAutoLoad = true,
}: {
  attack: Build | null;
  defense: Build | null;
  active?: boolean;
  allowAutoLoad?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(() =>
    attack ? findSpecies(attack).id : "",
  );
  const [config, setConfig] = useState<SpeedConfig>(() =>
    attack
      ? configFromBuild(attack)
      : { points: 0, nature: "neutral", scarf: false, stage: 0 },
  );
  const [pickerSearch, setPickerSearch] = useState("");
  const [preset, setPreset] = useState<SpeedPresetFilter>("all");
  const [opponentStage, setOpponentStage] = useState<SpeedStageFilter>("all");
  const [opponentAbility, setOpponentAbility] = useState<SpeedAbility>("none");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const selectedRow = useRef<HTMLTableRowElement>(null);
  const tableScroll = useRef<HTMLDivElement>(null);
  const firstOpen = useRef(true);
  const selected = roster.find((p) => p.id === selectedId) ?? roster[0];
  const effectiveConfig = resolveSpeedConfig(selected, config);
  const ownAbilities = availableSpeedAbilities(selected);
  const speed = selectedId
    ? calculateSpeed(selected.baseSpeed, effectiveConfig)
    : 0;
  const opponentDescription = `${preset === "all" ? "すべての配分" : speedPresets[preset].label} / ランク${opponentStage === "all" ? "±0・＋1・＋2" : opponentStage > 0 ? `＋${opponentStage}` : "±0"}${opponentAbility !== "none" ? ` / ${speedAbilities[opponentAbility].name}発動` : ""}`;
  const entries = useMemo(
    () =>
      selectedId
        ? compareSpeedBuilds(roster, selectedId, speed, preset, {
            stage: opponentStage,
            ability: opponentAbility,
          })
        : [],
    [selectedId, speed, preset, opponentStage, opponentAbility],
  );
  const faster = entries.filter((p) => p.difference > 0);
  const same = entries.filter((p) => p.difference === 0);
  const slower = entries.filter((p) => p.difference < 0);
  const closestFaster = faster.at(-1);
  const closestSlower = slower[0];
  const maximum = Math.max(speed, entries[0]?.speed ?? speed);
  const minimum = Math.min(speed, entries.at(-1)?.speed ?? speed);
  const buckets = Array.from(
    { length: 20 },
    (_, i) =>
      entries.filter(
        (p) =>
          Math.min(
            19,
            Math.floor(
              ((p.speed - minimum) / Math.max(1, maximum - minimum)) * 20,
            ),
          ) === i,
      ).length,
  );
  const maxBucket = Math.max(...buckets, 1);
  const options = roster.filter((p) =>
    normalizePokemonSearch(`${p.name} ${p.englishName} ${p.number}`).includes(
      normalizePokemonSearch(pickerSearch),
    ),
  );
  const visible = entries.filter(
    (p) =>
      normalizePokemonSearch(`${p.name} ${p.englishName} ${p.number}`).includes(
        normalizePokemonSearch(search),
      ) &&
      (filter === "all" ||
        (filter === "near" && Math.abs(p.difference) <= 20) ||
        (filter === "faster" && p.difference > 0) ||
        (filter === "same" && p.difference === 0) ||
        (filter === "slower" && p.difference < 0)),
  );
  const rows = [
    ...visible.map((p) => ({ ...p, own: false as const })),
    {
      ...selected,
      speed,
      difference: 0,
      own: true as const,
      rowId: "selected",
      preset: null,
      appliedConfig: effectiveConfig,
    },
  ].sort(
    (a, b) =>
      b.speed - a.speed || Number(b.own) - Number(a.own) || a.number - b.number,
  );
  useLayoutEffect(() => {
    if (!active || !selectedId) return;
    const row = selectedRow.current;
    const container = tableScroll.current;
    if (!row || !container) return;
    const center = () => {
      container.scrollTop +=
        row.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        (container.clientHeight - row.clientHeight) / 2;
    };
    center();
    if (firstOpen.current) {
      row.scrollIntoView({ behavior: "auto", block: "center" });
      firstOpen.current = false;
    }
    // Keep the row centered when fonts or responsive wrapping change row heights.
    const observer = new ResizeObserver(center);
    observer.observe(container);
    observer.observe(container.querySelector("table")!);
    return () => observer.disconnect();
  }, [
    active,
    selectedId,
    speed,
    preset,
    opponentStage,
    opponentAbility,
    search,
    filter,
  ]);
  useLayoutEffect(() => {
    if (!active || !allowAutoLoad || selectedId || !attack) return;
    setSelectedId(findSpecies(attack).id);
    setConfig(configFromBuild(attack));
  }, [active, allowAutoLoad, attack, selectedId]);
  function useBuild(build: Build) {
    setSelectedId(findSpecies(build).id);
    setConfig(configFromBuild(build));
    setPickerSearch("");
  }
  function jumpToSelected() {
    selectedRow.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    selectedRow.current?.focus({ preventScroll: true });
  }
  if (!selectedId)
    return (
      <div className="speed-page">
        <div className="speed-workspace">
          <section
            className="speed-setup"
            aria-labelledby="speed-setup-title"
            data-guide-target="speed-setup"
          >
            <div className="speed-panel-heading">
              <span className="speed-step">01</span>
              <h2 id="speed-setup-title">比較するポケモン</h2>
            </div>
            <div className="speed-import">
              <button
                disabled={!attack}
                onClick={() => attack && useBuild(attack)}
              >
                攻撃側から読込
              </button>
              <button
                disabled={!defense}
                onClick={() => defense && useBuild(defense)}
              >
                受け側から読込
              </button>
            </div>
            <label className="speed-label">
              ポケモンを検索
              <input
                type="search"
                placeholder="名前・図鑑番号"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
            </label>
            <label className="speed-label">
              ポケモンを選択
              <select
                value=""
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setConfig({
                    points: 0,
                    nature: "neutral",
                    scarf: false,
                    stage: 0,
                  });
                }}
              >
                <option value="">ポケモンを選択してください</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {options.length === 0 && (
              <p className="speed-muted" role="status">
                該当するポケモンがいません。
              </p>
            )}
            <p className="speed-muted">
              ポケモンを選ぶと、すばやさの分布と近い相手を表示します。
            </p>
          </section>
          <section className="speed-position" aria-live="polite">
            <div className="speed-panel-heading">
              <span className="speed-step">02</span>
              <h2>すばやさ比較</h2>
            </div>
            <p>比較するポケモンを選んでください。</p>
          </section>
        </div>
      </div>
    );
  return (
    <div className="speed-page">
      <div className="speed-workspace">
        <section
          className="speed-setup"
          aria-labelledby="speed-setup-title"
          data-guide-target="speed-setup"
        >
          <div className="speed-panel-heading">
            <span className="speed-step">01</span>
            <h2 id="speed-setup-title">比較するポケモン</h2>
          </div>
          <div className="speed-import">
            <button
              disabled={!attack}
              onClick={() => attack && useBuild(attack)}
            >
              攻撃側から読込
            </button>
            <button
              disabled={!defense}
              onClick={() => defense && useBuild(defense)}
            >
              受け側から読込
            </button>
          </div>
          <label className="speed-label">
            ポケモンを検索
            <input
              type="search"
              placeholder="名前・図鑑番号"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
            />
          </label>
          <label className="speed-label">
            ポケモンを選択
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setConfig((c) => ({ ...c, scarf: false, ability: "none" }));
              }}
            >
              {!selectedId && (
                <option value="">ポケモンを選択してください</option>
              )}
              {!options.some((p) => p.id === selectedId) && (
                <option value={selectedId}>{selected.name}（選択中）</option>
              )}
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {options.length === 0 && (
            <p className="speed-muted" role="status">
              該当するポケモンがいません。
            </p>
          )}
          <div className="speed-species">
            <span>No. {String(selected.number).padStart(4, "0")}</span>
            <h3>{selected.name}</h3>
            <Types types={selected.types} />
            <p>
              すばやさ種族値 <strong>{selected.baseSpeed}</strong>
              {selected.mega && <small>メガシンカ</small>}
            </p>
          </div>
          <div className="speed-own-presets" aria-label="自分の配分プリセット">
            {(["fastest", "max", "zero", "slowest"] as const).map((key) => (
              <button
                key={key}
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    points: speedPresets[key].points,
                    nature: speedPresets[key].nature,
                  }))
                }
              >
                {speedPresets[key].label}
              </button>
            ))}
          </div>
          <label className="speed-label">
            性格のすばやさ補正
            <select
              value={config.nature}
              onChange={(e) =>
                setConfig({
                  ...config,
                  nature: e.target.value as SpeedConfig["nature"],
                })
              }
            >
              <option value="up">上昇補正 ×1.1</option>
              <option value="neutral">補正なし ×1.0</option>
              <option value="down">下降補正 ×0.9</option>
            </select>
          </label>
          <label className="speed-label speed-points">
            すばやさポイント{" "}
            <span>
              <PointInput
                label="すばやさポイント"
                max={32}
                value={config.points}
                onChange={(points) => setConfig({ ...config, points })}
              />{" "}
              / 32 SP
            </span>
          </label>
          <input
            className="speed-range"
            aria-label="すばやさポイントの調整"
            type="range"
            min={0}
            max={32}
            value={config.points}
            onChange={(e) =>
              setConfig({ ...config, points: Number(e.target.value) })
            }
          />
          <label className="speed-label">
            能力ランク
            <select
              value={config.stage}
              onChange={(e) =>
                setConfig({ ...config, stage: Number(e.target.value) })
              }
            >
              {Array.from({ length: 13 }, (_, i) => 6 - i).map((n) => (
                <option value={n} key={n}>
                  {n > 0 ? `+${n}` : n === 0 ? "±0（変化なし）" : n}
                </option>
              ))}
            </select>
          </label>
          <label className="speed-label">
            自分の特性（発動時）
            <select
              aria-label="自分の特性（発動時）"
              value={effectiveConfig.ability}
              onChange={(e) =>
                setConfig({
                  ...config,
                  ability: e.target.value as SpeedAbility,
                  scarf: e.target.value === "unburden" ? false : config.scarf,
                })
              }
            >
              <option value="none">特性補正なし</option>
              {ownAbilities.map((key) => (
                <option key={key} value={key}>
                  {speedAbilities[key].name}（{speedAbilities[key].condition}）
                </option>
              ))}
            </select>
          </label>
          <label className="speed-scarf">
            <input
              type="checkbox"
              checked={effectiveConfig.scarf}
              disabled={selected.mega || effectiveConfig.ability === "unburden"}
              onChange={(e) =>
                setConfig({ ...config, scarf: e.target.checked })
              }
            />
            こだわりスカーフ <span>×1.5</span>
          </label>
          {selected.mega && (
            <p className="speed-muted">
              メガストーンとスカーフは併用できません。
            </p>
          )}
          {effectiveConfig.ability === "unburden" && (
            <p className="speed-muted">
              かるわざ発動中は持ち物がないため、スカーフは適用しません。
            </p>
          )}
        </section>

        <div className="speed-overview">
          <section
            className="speed-position"
            aria-labelledby="speed-position-title"
          >
            <div className="speed-panel-heading">
              <span className="speed-step">02</span>
              <h2 id="speed-position-title">いまのすばやさ帯</h2>
              <span className="speed-live">条件に連動</span>
            </div>
            <div className="speed-value-row">
              <div>
                <p>{selected.name}</p>
                <strong className="speed-big-value">{speed}</strong>
                <span className="speed-value-unit">すばやさ実数値</span>
              </div>
              <div className="speed-rank">
                <span>比較対象の型の中で</span>
                <strong>
                  {faster.length + 1}
                  <small> / {entries.length + 1}</small>
                </strong>
                <span>同速は同順位</span>
              </div>
            </div>
            <div className="speed-band-label">
              <strong>
                {Math.floor(speed / 20) * 20}〜
                {Math.floor(speed / 20) * 20 + 19}の帯
              </strong>
              <span>相手の条件：{opponentDescription}</span>
            </div>
            <div
              className="speed-distribution"
              role="img"
              aria-label={`すばやさ${minimum}から${maximum}の分布。自分は${speed}。`}
            >
              <div className="speed-histogram">
                {buckets.map((count, i) => (
                  <span
                    key={i}
                    style={{
                      height: `${Math.max(5, (count / maxBucket) * 100)}%`,
                    }}
                    title={`${count}型`}
                  />
                ))}
              </div>
              <span
                className="speed-location"
                style={{
                  left: `${((speed - minimum) / Math.max(1, maximum - minimum)) * 100}%`,
                }}
              >
                <b>{speed}</b>
              </span>
            </div>
            <div className="speed-distribution-axis">
              <span>
                {minimum} <small>遅い</small>
              </span>
              <span>
                <small>速い</small> {maximum}
              </span>
            </div>
            <div className="speed-counts">
              <div>
                <span>自分より速い</span>
                <strong>
                  {faster.length}
                  <small>型</small>
                </strong>
              </div>
              <div className="speed-count-same">
                <span>同じすばやさ</span>
                <strong>
                  {same.length}
                  <small>型</small>
                </strong>
              </div>
              <div>
                <span>自分より遅い</span>
                <strong>
                  {slower.length}
                  <small>型</small>
                </strong>
              </div>
            </div>
          </section>
          <section
            className="speed-neighbors"
            aria-labelledby="speed-neighbors-title"
          >
            <div className="speed-panel-heading">
              <h2 id="speed-neighbors-title">近い相手をチェック</h2>
              <span>現在の比較条件</span>
            </div>
            <div className="speed-neighbor-grid">
              {[
                { label: "すぐ上の相手", p: closestFaster },
                { label: "同速の相手", p: same[0] },
                { label: "すぐ下の相手", p: closestSlower },
              ].map(({ label, p }) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{p?.speed ?? "—"}</strong>
                  <span>
                    {p
                      ? `${p.name}（${speedPresets[p.preset].label}${p.appliedConfig.stage > 0 ? ` / ＋${p.appliedConfig.stage}` : ""}）`
                      : "該当なし"}
                  </span>
                  <em>
                    {p
                      ? p.difference === 0
                        ? `${same.length}型が同速`
                        : `自分との差 ${p.difference > 0 ? "+" : ""}${p.difference}`
                      : "比較対象なし"}
                  </em>
                </div>
              ))}
            </div>
          </section>
          <p className="speed-scope-note">
            特性は表示した発動条件を満たす想定で計算します。相手は自身の技・特性で上昇可能なランクも一覧に含めます。自分の上昇後の状態は能力ランクで指定してください。おいかぜ・まひの減速・トリックルーム・技の優先度は含みません。
          </p>
        </div>
      </div>

      <section className="speed-list" aria-labelledby="speed-list-title">
        <div className="speed-list-heading">
          <div>
            <span className="eyebrow">SPEED TIERS</span>
            <h2 id="speed-list-title">
              全ポケモンと比較<span>{roster.length}フォーム</span>
            </h2>
          </div>
          <button className="speed-jump" onClick={jumpToSelected}>
            自分の位置へ ↓
          </button>
        </div>
        <div className="speed-comparison-settings">
          <div>
            <span className="speed-label">配分で絞り込み</span>
            <div
              className="speed-preset-tabs"
              role="group"
              aria-label="配分で絞り込み"
            >
              <button
                aria-pressed={preset === "all"}
                className={preset === "all" ? "active" : ""}
                onClick={() => setPreset("all")}
              >
                すべて
              </button>
              {(Object.keys(speedPresets) as SpeedPreset[]).map((key) => (
                <button
                  key={key}
                  aria-pressed={preset === key}
                  className={preset === key ? "active" : ""}
                  onClick={() => setPreset(key)}
                >
                  {speedPresets[key].label}
                </button>
              ))}
            </div>
          </div>
          <div className="speed-opponent-modifiers">
            <div>
              <span className="speed-label">相手の能力ランク</span>
              <div
                className="speed-preset-tabs"
                role="group"
                aria-label="相手の能力ランク"
              >
                {(["all", 0, 1, 2] as const).map((stage) => (
                  <button
                    key={stage}
                    aria-pressed={opponentStage === stage}
                    className={opponentStage === stage ? "active" : ""}
                    onClick={() => setOpponentStage(stage)}
                  >
                    {stage === "all"
                      ? "すべて"
                      : stage === 0
                        ? "±0"
                        : `＋${stage}`}
                  </button>
                ))}
              </div>
            </div>
            <label className="speed-label">
              相手の特性（発動時）
              <select
                aria-label="相手の特性（発動時）"
                value={opponentAbility}
                onChange={(e) =>
                  setOpponentAbility(e.target.value as SpeedAbility)
                }
              >
                {comparisonAbilities.map((key) => (
                  <option key={key} value={key}>
                    {speedAbilities[key].name}
                    {key !== "none"
                      ? `（${speedAbilities[key].condition}）`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>
            {preset === "all"
              ? "代表的な5配分をまとめて表示"
              : speedPresets[preset].detail}
            <br />
            <span>
              相手の能力ランクは
              {opponentStage === "all"
                ? "±0・＋1・＋2（上昇可能な型のみ）"
                : opponentStage === 0
                  ? "±0"
                  : `＋${opponentStage}（上昇可能な型のみ）`}
              {preset === "scarf" || preset === "all"
                ? "・スカーフ不可の型は除外"
                : "・もちもの補正なし"}
              {opponentAbility !== "none" && (
                <>
                  <br />
                  {speedAbilities[opponentAbility].name}発動想定
                </>
              )}
            </span>
          </p>
        </div>
        <p className="speed-ability-note">
          配分・ランクごとに表示します。＋1・＋2は習得技や特性で上昇できる相手のみ。比較条件に根拠を表示します（複数ある場合は一例）。特性は発動条件を満たす想定です。
        </p>
        <div className="speed-list-tools">
          <input
            aria-label="比較一覧を検索"
            type="search"
            placeholder="ポケモン名で絞り込む"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label>
            表示範囲
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">すべて</option>
              <option value="near">自分の前後 ±20</option>
              <option value="faster">自分より速い</option>
              <option value="same">同速のみ</option>
              <option value="slower">自分より遅い</option>
            </select>
          </label>
          <span role="status">{visible.length}型 ＋ 選択中</span>
        </div>
        <div className="speed-table-scroll" ref={tableScroll}>
          <table className="speed-table">
            <thead>
              <tr>
                <th scope="col">すばやさ</th>
                <th scope="col">ポケモン</th>
                <th scope="col">種族値</th>
                <th scope="col">自分との差</th>
                <th scope="col">比較条件</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.rowId}
                  ref={p.own ? selectedRow : undefined}
                  tabIndex={p.own ? -1 : undefined}
                  className={
                    p.own
                      ? "speed-selected-row"
                      : p.difference === 0
                        ? "speed-tied-row"
                        : ""
                  }
                >
                  <td>
                    <strong>{p.speed}</strong>
                    <div className="speed-row-meter">
                      <span
                        style={{ width: `${(p.speed / maximum) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="speed-row-pokemon">
                      <img
                        className="speed-pokemon-icon"
                        src={artwork(p.id)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      <div>
                        <span className="speed-row-name">
                          {p.name}
                          {p.own && <b>選択中</b>}
                        </span>
                        <Types types={p.types} />
                      </div>
                    </div>
                  </td>
                  <td>{p.baseSpeed}</td>
                  <td>
                    <span
                      className={`speed-difference ${p.difference > 0 ? "faster" : p.difference < 0 ? "slower" : "same"}`}
                    >
                      {p.own
                        ? "基準"
                        : p.difference === 0
                          ? "同速"
                          : `${p.difference > 0 ? "+" : ""}${p.difference}`}
                    </span>
                  </td>
                  <td>
                    {p.own
                      ? `${config.points} SP / ${config.nature === "up" ? "上昇" : config.nature === "down" ? "下降" : "補正なし"}${effectiveConfig.scarf ? " / スカーフ" : ""}${config.stage !== 0 ? ` / ランク${config.stage > 0 ? "+" : ""}${config.stage}` : ""}`
                      : `${speedPresets[p.preset].label}${p.appliedConfig.stage > 0 ? ` / ランク＋${p.appliedConfig.stage}` : ""}`}
                    {!p.own && p.rankSources.length > 0 && (
                      <span
                        className="speed-rank-source"
                        title={p.rankSources.join(" / ")}
                      >
                        {p.rankSources[0]}
                        {p.rankSources.length > 1 && (
                          <details>
                            <summary>
                              ほか{p.rankSources.length - 1}件の上昇手段
                            </summary>
                            {p.rankSources.slice(1).map((source) => (
                              <span key={source}>{source}</span>
                            ))}
                          </details>
                        )}
                      </span>
                    )}
                    {p.appliedConfig.ability &&
                      p.appliedConfig.ability !== "none" && (
                        <span className="speed-ability-tag">
                          {speedAbilities[p.appliedConfig.ability].name}発動 ×
                          {speedAbilities[p.appliedConfig.ability].multiplier}
                        </span>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="speed-no-results">
            条件に合う比較相手がいません。検索や表示範囲を変更してください。
          </p>
        )}
        <div className="speed-data-note">
          <span>
            対象データ：{rosterData.retrievedAt}取得 ／ フォーム違いを含む
          </span>
          <details>
            <summary>データと比較条件について</summary>
            <p>
              Pokémon ShowdownのChampions用データで利用可能扱いの全
              {roster.length}
              フォームを収録しています。公式の参加可否を保証するものではなく、開催中のレギュレーションによる追加制限は別途確認してください。対象種族の追加はデータ更新時に反映します。採用統計の日次更新とは別です。
            </p>
            <p>
              すばやさ実数値は「（種族値 ＋ ポイント ＋ 20）×
              性格補正」の小数点以下を切り捨て、その後に能力ランク・特性・スカーフ補正を適用します。特性は発動条件が成立し、効果が無効化されていない想定です。通常は代表的な5配分と、習得技・特性で到達できる＋1・＋2の状態をまとめて比較します。配分・ランクのボタンで絞り込めます。ランクは±0から、表示した手段を指定回数使用・発動した想定です。相手からの能力上昇、能力コピー、複数の技・特性の組合せは列挙しません。順位・分布・件数は型の数で、配分の絞り込みを反映し、名前検索・表示範囲で絞る前の比較対象を基準とします。任意のポイント配分を全通り列挙するものではありません。
            </p>
            <a
              href="https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions"
              target="_blank"
              rel="noreferrer"
            >
              Pokémon Showdown
            </a>
            <a
              href="https://github.com/PokeAPI/pokeapi"
              target="_blank"
              rel="noreferrer"
            >
              日本語名：PokeAPI
            </a>
            <a
              href="/third-party/pokemon-showdown-LICENSE.txt"
              target="_blank"
              rel="noreferrer"
            >
              Showdownライセンス
            </a>
            <a
              href="/third-party/pokeapi-LICENSE.txt"
              target="_blank"
              rel="noreferrer"
            >
              PokeAPIライセンス
            </a>
          </details>
        </div>
      </section>
    </div>
  );
}
