import {
  itemRecovery,
  type RecoveryMode,
  type RepeatedKOInput,
} from "./item-recovery.ts";
import {
  calculate,
  Generations,
  Pokemon as CalcPokemon,
  Move,
  Field,
  type State,
  type StatsTable,
} from "@smogon/calc";
import {
  getFinalSpeed,
  checkAirLock,
} from "@smogon/calc/dist/mechanics/util.js";
import {
  getPokemon,
  resolveBattleBuild,
  itemCatalog,
  moveByName,
  englishAbility,
  englishItem,
  englishNatures,
  type Build,
} from "./data.ts";
export const generation = Generations.get(0);
export type SideState = {
  hp: number;
  status: "" | "brn" | "par" | "psn" | "tox" | "slp" | "frz";
  boosts: number[];
  abilityOn: boolean;
  tailwind: boolean;
  reflect: boolean;
  lightScreen: boolean;
  protected: boolean;
};
export type BattleField = {
  weather: string;
  terrain: string;
  trickRoom: boolean;
  gravity: boolean;
};
export const defaultSide = (): SideState => ({
  hp: 100,
  status: "",
  boosts: [0, 0, 0, 0, 0, 0],
  abilityOn: false,
  tailwind: false,
  reflect: false,
  lightScreen: false,
  protected: false,
});
const keys = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
const stats = (values: number[]): StatsTable =>
  Object.fromEntries(keys.map((k, i) => [k, values[i]])) as StatsTable;
export function calcPokemon(build: Build, side: SideState) {
  build = resolveBattleBuild(build);
  const p = getPokemon(build.pokemonId);
  if (
    !p.calcName ||
    !generation.species.get(
      p.calcName.toLowerCase().replace(/[^a-z0-9]/g, "") as never,
    )
  )
    throw new Error("このフォームは計算データ未対応です");
  if (
    build.points.length !== 6 ||
    build.points.some((v) => !Number.isInteger(v) || v < 0 || v > 32) ||
    build.points.reduce((a, b) => a + b, 0) > 66
  )
    throw new Error("能力ポイントは各0〜32、合計66までです");
  if (
    side.hp < 1 ||
    side.hp > 100 ||
    side.boosts.some((v) => !Number.isInteger(v) || Math.abs(v) > 6)
  )
    throw new Error("HPまたは能力ランクが範囲外です");
  const ability = englishAbility(build.ability),
    item = englishItem(build.item);
  if (!ability || item === undefined || !englishNatures[build.nature])
    throw new Error("特性・もちもの・性格を確認してください");
  const isMatchingMegaStone = Object.values(itemCatalog).some(
    (entry) =>
      entry.englishName === item &&
      entry.megaStone &&
      Object.values(entry.megaStone).includes(p.calcName ?? ""),
  );
  if (p.mega && item && !isMatchingMegaStone)
    throw new Error(
      "メガフォームの追加もちもの補正には対応していません。もちものなしを選んでください",
    );
  const mon = new CalcPokemon(generation, p.calcName, {
    nature: englishNatures[build.nature],
    ability,
    item: ability === "Unburden" && side.abilityOn ? "" : item,
    abilityOn: side.abilityOn,
    evs: stats(build.points),
    boosts: stats(side.boosts),
    status: side.status,
    moves: build.moves.map((m) => moveByName(m)?.englishName ?? m),
  });
  mon.originalCurHP = Math.max(1, Math.floor((mon.maxHP() * side.hp) / 100));
  return mon;
}
export function calcField(
  field: BattleField,
  attack: SideState,
  defense: SideState,
) {
  const weather: Record<string, State.Field["weather"]> = {
    なし: undefined,
    はれ: "Sun",
    あめ: "Rain",
    すなあらし: "Sand",
    ゆき: "Snow",
  };
  const terrain: Record<string, State.Field["terrain"]> = {
    なし: undefined,
    エレキ: "Electric",
    グラス: "Grassy",
    ミスト: "Misty",
    サイコ: "Psychic",
  };
  const side = (s: SideState) => ({
    isReflect: s.reflect,
    isLightScreen: s.lightScreen,
    isProtected: s.protected,
    isTailwind: s.tailwind,
  });
  return new Field({
    gameType: "Singles",
    weather: weather[field.weather],
    terrain: terrain[field.terrain],
    isGravity: field.gravity,
    attackerSide: side(attack),
    defenderSide: side(defense),
  });
}
export type DamageResult = {
  min: number;
  max: number;
  minPercent: number;
  maxPercent: number;
  maxHP: number;
  currentHP: number;
  koChance: number | null;
  rolls: number[];
  statusMove: boolean;
  notes: string[];
  attackSpeed: number;
  defenseSpeed: number;
  recovery: ReturnType<typeof itemRecovery>;
  repeatedKOInput: RepeatedKOInput;
};
export function damageFor(
  attack: Build,
  defense: Build,
  moveName: string,
  as: SideState,
  ds: SideState,
  field: BattleField,
  crit = false,
  hits?: number,
  recoveryMode: RecoveryMode = "auto",
): DamageResult {
  const data = moveByName(moveName);
  if (!data) throw new Error("技を選択してください");
  if (
    hits &&
    data.multihit &&
    (typeof data.multihit === "number"
      ? hits !== data.multihit
      : hits < data.multihit[0] || hits > data.multihit[1])
  )
    throw new Error("この連続技の命中回数が範囲外です");
  const a = calcPokemon(attack, as),
    d = calcPokemon(defense, ds),
    f = calcField(field, as, ds);
  const move = new Move(generation, data.englishName, {
    ability: a.ability,
    item: a.item,
    species: a.name,
    isCrit: crit,
    ...(hits && data.multihit ? { hits } : {}),
  });
  checkAirLock(a, f);
  checkAirLock(d, f);
  const result = calculate(generation, a, d, move, f);
  const raw = result.damage;
  const arrays: number[][] =
    typeof raw === "number"
      ? [[raw]]
      : Array.isArray(raw[0])
        ? (raw as number[][])
        : raw.length === 2
          ? raw.map((x) => [x as number])
          : [raw as number[]];
  let distribution = new Map<number, number>([[0, 1]]);
  const notes: string[] = [];
  const sash =
    (d.item === "Focus Sash" ||
      (d.ability === "Sturdy" && a.ability !== "Mold Breaker")) &&
    d.curHP() === d.maxHP();
  for (const rolls of arrays) {
    const next = new Map<number, number>();
    for (const [total, prob] of distribution)
      for (const roll of rolls) {
        let taken = total + roll;
        if (sash && total === 0 && roll >= d.maxHP()) taken = d.maxHP() - 1;
        next.set(taken, (next.get(taken) ?? 0) + prob / rolls.length);
      }
    distribution = next;
  }
  const possible = [...distribution.keys()];
  const recoveryInput: RepeatedKOInput = {
    maxHP: d.maxHP(),
    currentHP: d.curHP(),
    hitRolls: arrays,
    item: d.item ?? "",
    defenderAbility: d.ability ?? "",
    attackerAbility: a.ability ?? "",
    attackerItem: a.item ?? "",
    move: data.englishName,
    mode: recoveryMode,
    surviveFullHP: sash,
    focusSash: d.item === "Focus Sash" && sash,
  };
  const recovery = itemRecovery(recoveryInput);
  if (sash) notes.push("満タン時のきあいのタスキ／がんじょうを反映");
  const unsupported =
    (d.ability === "Disguise" &&
      a.ability !== "Mold Breaker" &&
      !getPokemon(defense.pokemonId).speciesId?.includes("busted")) ||
    d.item === "Focus Band";
  if (d.item === "Focus Band")
    notes.push(
      "きあいのハチマキの生存判定は未計算のため、一撃撃破率を保留しています",
    );
  if (unsupported && d.ability === "Disguise")
    notes.push(
      "ばけのかわが残っている場合の身代わり効果は未計算。解除後のフォームを選んでください",
    );
  if (data.multihit)
    notes.push(`連続技は${move.hits}回命中の想定（回数を変更可能）`);
  if (data.category === "Status")
    notes.push("変化技のため直接ダメージはありません");
  const min = Math.min(...possible),
    max = Math.max(...possible);
  return {
    min,
    max,
    minPercent: (min / d.maxHP()) * 100,
    maxPercent: (max / d.maxHP()) * 100,
    maxHP: d.maxHP(),
    currentHP: d.curHP(),
    koChance: unsupported ? null : recovery.koChance,
    recovery,
    rolls: possible,
    statusMove: data.category === "Status",
    notes,
    attackSpeed: getFinalSpeed(generation, a, f, f.attackerSide),
    defenseSpeed: getFinalSpeed(generation, d, f, f.defenderSide),
    repeatedKOInput: recoveryInput,
  };
}
export function actionOrder(
  a: Build,
  d: Build,
  am: string,
  dm: string,
  as: SideState,
  ds: SideState,
  field: BattleField,
) {
  const ap = calcPokemon(a, as),
    dp = calcPokemon(d, ds),
    f = calcField(field, as, ds);
  checkAirLock(ap, f);
  checkAirLock(dp, f);
  const attackSpeed = getFinalSpeed(generation, ap, f, f.attackerSide),
    defenseSpeed = getFinalSpeed(generation, dp, f, f.defenderSide);
  const priority = (b: CalcPokemon, name: string) => {
    const m = moveByName(name);
    if (!m) return 0;
    return (
      m.priority +
      (b.ability === "Prankster" && m.category === "Status" ? 1 : 0) +
      (b.ability === "Gale Wings" &&
      b.curHP() === b.maxHP() &&
      m.type === "flying"
        ? 1
        : 0) +
      (b.ability === "Triage" && m.heal ? 3 : 0)
    );
  };
  const pa = priority(ap, am),
    pd = priority(dp, dm);
  const lag = (p: CalcPokemon) =>
    p.item === "Lagging Tail" ||
    p.item === "Full Incense" ||
    p.ability === "Stall";
  let comparison = pa - pd;
  if (!comparison && lag(ap) !== lag(dp)) comparison = lag(ap) ? -1 : 1;
  if (!comparison)
    comparison = (attackSpeed - defenseSpeed) * (field.trickRoom ? -1 : 1);
  const uncertain =
    pa === pd &&
    [ap, dp].some(
      (p) =>
        p.item === "Quick Claw" ||
        p.ability === "Quick Draw" ||
        (p.item === "Custap Berry" && p.curHP() <= p.maxHP() / 4),
    );
  return {
    attackSpeed,
    defenseSpeed,
    attackPriority: pa,
    defensePriority: pd,
    first: uncertain
      ? "unknown"
      : comparison > 0
        ? "attack"
        : comparison < 0
          ? "defense"
          : "tie",
    reason: uncertain
      ? "確率で先に動く効果があるため順番は未確定"
      : pa !== pd
        ? "技の優先度を比較"
        : lag(ap) !== lag(dp)
          ? "後攻になる特性・もちものを反映"
          : field.trickRoom
            ? "同じ優先度ではトリックルームを反映"
            : "同じ優先度のすばやさを比較",
  };
}
