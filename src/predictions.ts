import {
  getPokemon,
  resolveBattleBuild,
  makeBuild,
  moveByName,
  moveCatalog,
  abilityCatalog,
  itemCatalog,
  itemsForPokemon,
  englishNatures,
  englishAbility,
  usageSourcePokemon,
  learnableMoves,
  type Build,
} from "./data.ts";
import {
  damageFor,
  actionOrder,
  defaultSide,
  type SideState,
  type BattleField,
} from "./battle.ts";
import {
  usageCompatible,
  type UsageSeasonContext,
  type UsageSnapshot,
} from "./usage.ts";
export type KnownInfo = {
  ability: boolean;
  item: boolean;
  nature: boolean;
  points: boolean;
  moves: string[];
};
export const unknownInfo = (): KnownInfo => ({
  ability: false,
  item: false,
  nature: false,
  points: false,
  moves: [],
});
export type OpponentSlot = {
  id: number | null;
  state: "unknown" | "selected" | "fainted";
  observedBuild?: Build;
  known?: KnownInfo;
};
export type Assumption = { label: string; build: Build; notes: string[] };
export function assumptions(
  build: Build,
  known: KnownInfo,
  usage?: UsageSnapshot,
  seasonContext?: UsageSeasonContext,
): Assumption[] {
  const p = getPokemon(build.pokemonId),
    usagePokemon = usageSourcePokemon(p.id),
    usable =
      usageCompatible(usage, seasonContext) &&
      usage?.speciesId === usagePokemon?.speciesId
        ? usage
        : undefined;
  const rows = usable?.rows ?? [];
  const top = (category: string) => rows.find((r) => r.category === category);
  const item = Object.values(itemCatalog).find(
    (v) => v.englishName === top("held_item")?.name,
  )?.name;
  const ability = Object.values(abilityCatalog).find(
    (v) => v.englishName === top("ability")?.name,
  )?.name;
  const nature = Object.entries(englishNatures).find(
    ([, en]) => en === top("stat_alignment")?.name,
  )?.[0];
  const popular: Build = {
    ...build,
    ability: known.ability
      ? build.ability
      : ability && p.abilities.includes(ability)
        ? ability
        : build.ability,
    item: known.item
      ? build.item
      : item && itemsForPokemon(p).includes(item)
        ? item
        : build.item,
    nature: known.nature ? build.nature : (nature ?? build.nature),
    points: known.points
      ? build.points
      : (top("stat_points")?.points ?? build.points),
  };
  const notes = [
    ...(!known.ability ? ["特性は仮定"] : []),
    ...(!known.item ? ["もちものは仮定"] : []),
    ...(!known.nature ? ["性格は仮定"] : []),
    ...(!known.points ? ["配分は仮定"] : []),
  ];
  if (!notes.length)
    return [
      {
        label: "判明済みの型",
        build,
        notes: ["入力済みの特性・もちもの・性格・配分で計算"],
      },
    ];
  const effective = getPokemon(resolveBattleBuild(popular).pokemonId);
  const physical = effective.stats[1] >= effective.stats[3];
  const speed: Build = {
    ...popular,
    nature: known.nature ? build.nature : physical ? "ようき" : "おくびょう",
    points: known.points
      ? build.points
      : physical
        ? [2, 32, 0, 0, 0, 32]
        : [2, 0, 0, 32, 0, 32],
  };
  const bulk: Build = {
    ...popular,
    nature: known.nature ? build.nature : "ずぶとい",
    points: known.points ? build.points : [32, 0, 32, 0, 2, 0],
  };
  const variants = [
    {
      label: usable ? "採用上位の仮定" : "入力値の仮定",
      build: popular,
      notes: [
        ...notes,
        ...(usable && usagePokemon?.id !== p.id
          ? [`統計元はメガシンカ前の${usagePokemon?.name}です`]
          : []),
        ...(usable
          ? [
              "各項目の採用率を独立に組み合わせています。実在する型の割合ではありません",
            ]
          : ["統計なし・入力値を基準"]),
      ],
    },
    { label: "速度重視の仮定", build: speed, notes },
    { label: "物理耐久の仮定", build: bulk, notes },
    ...(!known.item && !p.mega
      ? [
          {
            label: "スカーフの仮定",
            build: { ...speed, item: "こだわりスカーフ" },
            notes,
          },
        ]
      : []),
  ];
  const seen = new Set<string>();
  return variants.filter((v) => {
    const key = JSON.stringify(v.build);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export type Candidate = {
  key: string;
  name: string;
  kind: "攻撃" | "変化" | "交代";
  score: number;
  reasons: string[];
  assumptions: string[];
  canLead: boolean;
};
// Unconfirmed niche moves remain secondary cautions, never the primary prediction.
const PRIMARY_MOVE_USAGE_PERCENT = 20;
const PRIMARY_MOVE_USAGE_RANK = 4;
const statNames: Record<string, string> = {
  atk: "こうげき",
  def: "ぼうぎょ",
  spa: "とくこう",
  spd: "とくぼう",
  spe: "すばやさ",
  accuracy: "命中率",
  evasion: "回避率",
};
function buildForSwitch(slot: OpponentSlot) {
  const build = makeBuild(slot.id!);
  const observed = slot.observedBuild;
  const known = slot.known ?? unknownInfo();
  if (!observed) return build;
  return {
    ...build,
    ...(known.ability ? { ability: observed.ability } : {}),
    ...(known.item ? { item: observed.item } : {}),
    ...(known.nature ? { nature: observed.nature } : {}),
    ...(known.points ? { points: observed.points } : {}),
  };
}
function statChangeReason(stages: Record<string, number>, target: string) {
  const actorGetsEffect = ["self", "adjacentAllyOrSelf", "allies"].includes(
    target,
  );
  const recipient = actorGetsEffect ? "相手の" : "こちらの";
  return Object.entries(stages)
    .map(([stat, stage]) => {
      const name = statNames[stat] ?? stat;
      return `${recipient}${name}ランクを${stage > 0 ? "上げる" : "下げる"}`;
    })
    .join("・");
}
export function predictActions(input: {
  attack: Build;
  defense: Build;
  move: string;
  attackSide: SideState;
  defenseSide: SideState;
  field: BattleField;
  known: KnownInfo;
  usage?: UsageSnapshot;
  season?: string;
  seasonContext?: UsageSeasonContext;
  opponents: OpponentSlot[];
}) {
  const {
    attack,
    defense,
    move,
    attackSide,
    defenseSide,
    field,
    known,
    usage,
    opponents,
  } = input;
  if (
    (usage && !usageCompatible(usage, input.seasonContext)) ||
    (input.season &&
      (!input.seasonContext || input.seasonContext.season !== input.season))
  )
    return {
      candidates: [],
      warnings: [
        "取得したシーズンには計算側が未対応のため、自動予測を停止しています。",
      ],
    };
  const p = getPokemon(defense.pokemonId),
    legal = learnableMoves(p).map(([n]) => n);
  const rows = (
    usage && usage.speciesId === usageSourcePokemon(p.id)?.speciesId
      ? usage.rows
      : []
  ).filter((r) => r.category === "move");
  const names = [
    ...new Set([
      ...known.moves,
      ...(known.moves.length < 4
        ? rows
            .map(
              (r) =>
                Object.values(moveCatalog).find((m) => m.englishName === r.name)
                  ?.name,
            )
            .filter((n): n is string => !!n)
        : []),
    ]),
  ].filter((n) => legal.includes(n));
  const variants = assumptions(defense, known, usage, input.seasonContext);
  const enemy = variants[0].build;
  const candidates: Candidate[] = [];
  const warnings: string[] = [];
  if (defenseSide.status === "slp")
    warnings.push("ねむり継続を想定。目覚めるターンの予測は含みません。");
  if (!usage)
    warnings.push("採用率未取得：技は判明済みのものだけを評価します。");
  if (opponents.filter((p) => p.id !== null).length < 6)
    warnings.push(
      "相手の6体が未入力です。未判明の交代先はポケモン名を推測せず表示します。",
    );
  for (const name of names) {
    const data = moveByName(name)!;
    if (
      defenseSide.status === "slp" &&
      !["Sleep Talk", "Snore"].includes(data.englishName)
    )
      continue;
    if (
      defenseSide.status !== "slp" &&
      ["Sleep Talk", "Snore"].includes(data.englishName)
    )
      continue;
    if (defenseSide.status === "frz") {
      warnings.push(
        "こおり解除は予測しないため、相手の技候補を保留しています。",
      );
      continue;
    }
    if (data.statEffect?.target === "adjacentAlly") {
      warnings.push(
        `${name}はシングル戦で対象となる味方がいないため除外しました。`,
      );
      continue;
    }
    if (data.status && attackSide.status) continue;
    const effectiveAttack = resolveBattleBuild(attack);
    const target = getPokemon(effectiveAttack.pokemonId),
      targetAbility = englishAbility(effectiveAttack.ability);
    if (data.category === "Status" && data.status) {
      if (targetAbility === "Good as Gold") continue;
      if (
        data.status === "par" &&
        (target.types.includes("electric") || targetAbility === "Limber")
      )
        continue;
      if (
        ["psn", "tox"].includes(data.status) &&
        (target.types.some((t) => ["poison", "steel"].includes(t)) ||
          targetAbility === "Immunity")
      )
        continue;
      if (
        data.status === "brn" &&
        (target.types.includes("fire") ||
          targetAbility === "Water Veil" ||
          targetAbility === "Water Bubble")
      )
        continue;
      if (
        data.status === "slp" &&
        ["Insomnia", "Vital Spirit", "Sweet Veil"].includes(targetAbility ?? "")
      )
        continue;
    }
    const knownMove = known.moves.includes(name),
      row = rows.find((r) => r.name === data.englishName);
    const canLead =
      knownMove ||
      (row?.percent != null
        ? row.percent >= PRIMARY_MOVE_USAGE_PERCENT
        : !!row && row.rank <= PRIMARY_MOVE_USAGE_RANK);
    let score = knownMove ? 12 : 0;
    const reasons = [knownMove ? "判明済みの技" : "採用率からの技候補"];
    if (row?.percent !== null && row?.percent !== undefined) {
      reasons.push(`技の採用率 ${row.percent}%（行動の確率ではありません）`);
    }
    if (!knownMove && row?.percent == null && row)
      reasons.push(`技の採用順位 ${row.rank}位（採用率は未提供）`);
    if (!canLead)
      reasons.push("未判明かつ採用が少ない技のため、1位にはしない参考候補");
    try {
      if (data.category !== "Status") {
        const damage = damageFor(
          enemy,
          attack,
          name,
          defenseSide,
          attackSide,
          field,
        );
        if (damage.koChance === null) {
          warnings.push(
            `${name}は未計算の防御効果があるため評価を保留しました。`,
          );
          continue;
        }
        if (damage.max === 0) continue;
        score += Math.min(100, (damage.max / damage.currentHP) * 70);
        reasons.push(
          `こちらへのダメージ ${damage.minPercent.toFixed(1)}〜${damage.maxPercent.toFixed(1)}%`,
        );
        if (damage.koChance === 100) {
          score += 25;
          reasons.push("入力条件では一撃で倒せる");
        }
        const order = actionOrder(
          enemy,
          attack,
          name,
          move,
          defenseSide,
          attackSide,
          field,
        );
        if (order.first === "attack") {
          score += 12;
          reasons.push("この技なら相手が先に動く");
        }
        if (data.pivot) {
          score += 5;
          reasons.push("攻撃しながら交代する技");
        }
      } else if (data.heal) {
        if (defenseSide.hp >= 100) continue;
        score += (100 - defenseSide.hp) * 0.7;
        reasons.push(`相手のHPが${defenseSide.hp}%のため回復候補`);
      } else if (data.statEffect) {
        const { target: effectTarget, stages } = data.statEffect;
        const helpsActor =
          ["self", "adjacentAllyOrSelf", "allies"].includes(effectTarget) &&
          Object.values(stages).some((stage) => stage > 0);
        const lowersOpponent =
          ["normal", "adjacentFoe", "allAdjacentFoes"].includes(effectTarget) &&
          Object.values(stages).some((stage) => stage < 0);
        if (helpsActor || lowersOpponent) score += 14;
        reasons.push(
          `${statChangeReason(stages, effectTarget)}。成功率・効果量は別途確認`,
        );
        if (!helpsActor && !lowersOpponent)
          reasons.push("相手に有利な能力変化としては加点していません");
      } else {
        score += 5;
        reasons.push("盤面を変える技。成功条件・効果量は別途確認");
      }
      candidates.push({
        key: `move:${name}`,
        name,
        kind: data.category === "Status" ? "変化" : "攻撃",
        score:
          score *
          (knownMove
            ? 1
            : row?.percent != null
              ? row.percent / 100
              : 1 / Math.max(1, row?.rank ?? 1)),
        canLead,
        reasons,
        assumptions: [
          ...(knownMove ? [] : ["この技を覚えていると仮定"]),
          ...variants[0].notes,
          ...(data.category === "Status" ? ["変化技の成功可否は未判定"] : []),
        ],
      });
    } catch {
      warnings.push(`${name}は条件を計算できないため候補から除外しました。`);
    }
  }
  for (const slot of opponents) {
    if (!slot.id || slot.id === defense.pokemonId || slot.state === "fainted")
      continue;
    try {
      const target = buildForSwitch(slot);
      const incoming = damageFor(
        attack,
        target,
        move,
        attackSide,
        defaultSide(),
        field,
      );
      const current = damageFor(
        attack,
        enemy,
        move,
        attackSide,
        defenseSide,
        field,
      );
      if (incoming.maxPercent >= current.maxPercent) continue;
      const reasons = [
        `選択した技を受けた場合 ${incoming.minPercent.toFixed(1)}〜${incoming.maxPercent.toFixed(1)}%`,
        incoming.max === 0
          ? "選択した技を無効化できる"
          : "現在の対面より被ダメージを抑えられる",
      ];
      const known = slot.known ?? unknownInfo();
      const confirmed = [
        ...(known.ability ? ["特性"] : []),
        ...(known.item ? ["もちもの"] : []),
        ...(known.nature ? ["性格"] : []),
        ...(known.points ? ["配分"] : []),
      ];
      candidates.push({
        key: `switch:${slot.id}`,
        name: `${getPokemon(slot.id).name}へ交代`,
        kind: "交代",
        canLead: true,
        score: 30 + Math.min(55, current.maxPercent - incoming.maxPercent),
        reasons,
        assumptions: [
          slot.state === "selected"
            ? "選出済みとして入力"
            : "実際に選出されている場合",
          ...(confirmed.length
            ? [`判明済みの${confirmed.join("・")}を反映`]
            : ["判明項目なし"]),
          "未判明項目は標準値の仮定。交代先は満タン、設置技ダメージは未考慮",
        ],
      });
    } catch {
      warnings.push(`${getPokemon(slot.id).name}への交代は計算未対応です。`);
    }
  }
  const revealedSpecies = new Set([
    defense.pokemonId,
    ...opponents.flatMap((s) => (s.id !== null ? [s.id] : [])),
  ]);
  const confirmedSelection = new Set([
    defense.pokemonId,
    ...opponents.flatMap((s) =>
      s.id !== null && s.state !== "unknown" ? [s.id] : [],
    ),
  ]);
  // Do not invent an extra bench member once the six species or three selections are known.
  if (revealedSpecies.size < 6 && confirmedSelection.size < 3) {
    try {
      const incoming = damageFor(
        attack,
        enemy,
        move,
        attackSide,
        defenseSide,
        field,
      );
      const threatened = incoming.max / incoming.currentHP >= 0.5;
      const cannotAct = ["slp", "frz"].includes(defenseSide.status);
      if (incoming.koChance !== null && (threatened || cannotAct)) {
        candidates.push({
          key: "switch:unknown",
          name: "交代（交代先は不明）",
          kind: "交代",
          canLead: true,
          score:
            15 +
            Math.min(45, (incoming.max / incoming.currentHP) * 45) +
            (cannotAct ? 10 : 0),
          reasons: [
            ...(threatened
              ? [
                  `こちらの選択技は相手の現在HPに対して最大${((incoming.max / incoming.currentHP) * 100).toFixed(1)}%のダメージとなるため、交代を検討する状況`,
                ]
              : []),
            ...(cannotAct
              ? ["状態異常で行動しにくいため、交代を検討する状況"]
              : []),
          ],
          assumptions: [
            "未判明の控えが残り、交代できる場合の候補",
            "交代先の種族・型・被ダメージ・採用率は不明。安全に受けられるとは限りません",
          ],
        });
      }
    } catch {
      // No unknown-switch recommendation without an evaluable matchup.
    }
  }
  const ranked = candidates.sort(
    (a, b) => b.score - a.score || a.key.localeCompare(b.key),
  );
  const lead = ranked.find((c) => c.canLead);
  if (!lead && ranked.length)
    warnings.push(
      "評価できた技は採用が少ない未判明の技のみのため、1位を提示していません。判明技や交代先を入力してください。",
    );
  return {
    candidates: lead
      ? [lead, ...ranked.filter((c) => c !== lead)].slice(0, 3)
      : [],
    warnings: [...new Set(warnings)],
  };
}
