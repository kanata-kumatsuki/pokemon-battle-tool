import catalog from "./generated/battle-catalog.json" with { type: "json" };
import type { SpeedConfig, SpeedSpecies } from "./speed.ts";

// Reviewed against Showdown's moves.ts and abilities.ts. Only effects on the
// user are included; learnability and abilities come from the Champions catalog.
const moveRules: Record<
  string,
  { stages: number; condition?: string; once?: boolean }
> = {
  dragondance: { stages: 1 },
  quiverdance: { stages: 1 },
  shellsmash: { stages: 2 },
  agility: { stages: 2 },
  rockpolish: { stages: 2 },
  shiftgear: { stages: 2 },
  flamecharge: { stages: 1 },
  trailblaze: { stages: 1 },
  aquastep: { stages: 1 },
  rapidspin: { stages: 1 },
  scaleshot: { stages: 1 },
  aurawheel: { stages: 1 },
  clangoroussoul: { stages: 1 },
  noretreat: { stages: 1, once: true },
  ancientpower: { stages: 1, condition: "追加効果発動時" },
  acupressure: { stages: 2, condition: "すばやさが選ばれた場合" },
  // Negative self effects can raise Speed only with Contrary.
  hammerarm: { stages: -1 },
  icehammer: { stages: -1 },
  curse: { stages: -1 },
};
const secondaryBoostMoves = new Set([
  "ancientpower",
  "flamecharge",
  "trailblaze",
  "aquastep",
  "aurawheel",
  "rapidspin",
]);
const abilityRules: Record<
  string,
  { stages: number; condition: string; once?: boolean }
> = {
  "Speed Boost": { stages: 1, condition: "ターン終了時" },
  "Weak Armor": { stages: 2, condition: "物理技を受けた後" },
  Steadfast: { stages: 1, condition: "ひるんだ後" },
  Rattled: { stages: 1, condition: "むし・ゴースト・あく技／いかくを受けた後" },
  "Motor Drive": { stages: 1, condition: "でんき技を受けた後" },
  Moody: { stages: 2, condition: "すばやさ上昇が選ばれた場合" },
  "Battle Bond": { stages: 1, condition: "相手を倒した後・1戦1回", once: true },
};
const speciesCatalog = new Map(catalog.pokemon.map((p) => [p.speciesId, p]));
const moveNames = catalog.moves as Record<string, { name: string }>;
const abilityNames = new Map(
  Object.values(catalog.abilities).map((a) => [a.englishName, a.name]),
);

type Source = {
  label: string;
  stages: number;
  once?: boolean;
  condition?: string;
};

/** Witnesses for reaching exactly +1 or +2 from neutral without outside boosts. */
export function speedRankSources(
  species: SpeedSpecies,
  config: SpeedConfig,
  activeAbilityName = "",
): string[] {
  if (config.stage !== 1 && config.stage !== 2) return [];
  const data = speciesCatalog.get(species.id);
  if (!data) return []; // Do not invent learnability for an unknown form.
  const abilities = activeAbilityName ? [activeAbilityName] : species.abilities;
  const sources: Source[] = [];
  for (const [id, rule] of Object.entries(moveRules)) {
    if (!data.learnset.includes(id)) continue;
    if (id === "curse" && species.types.includes("ghost")) continue;
    // A fixed Contrary form cannot use positive boosts as a source.
    const compatible = abilities.find(
      (a) =>
        (rule.stages < 0 ? a === "Contrary" : a !== "Contrary") &&
        !(a === "Sheer Force" && secondaryBoostMoves.has(id)),
    );
    if (!compatible) continue;
    const stages = Math.abs(rule.stages) * (compatible === "Simple" ? 2 : 1);
    sources.push({
      ...rule,
      stages,
      label: `${moveNames[id].name}${compatible === "Contrary" ? "＋あまのじゃく" : compatible === "Simple" ? "＋たんじゅん" : ""}`,
    });
  }
  for (const ability of abilities) {
    const rule = abilityRules[ability];
    if (rule) sources.push({ ...rule, label: abilityNames.get(ability)! });
  }
  return sources.flatMap((source) => {
    const uses = config.stage / source.stages;
    if (!Number.isInteger(uses) || uses < 1 || (source.once && uses > 1))
      return [];
    return [
      `${source.label} ×${uses}${source.condition ? `（${source.condition}）` : ""}`,
    ];
  });
}
