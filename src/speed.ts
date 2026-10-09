import { speedRankSources } from "./speed-boosts.ts";

export type SpeedConfig = {
  points: number;
  nature: "up" | "neutral" | "down";
  scarf: boolean;
  stage: number;
  ability?: SpeedAbility;
};
export type SpeedSpecies = {
  id: string;
  number: number;
  name: string;
  englishName: string;
  baseSpeed: number;
  types: string[];
  mega: boolean;
  abilities: string[];
};
export const speedAbilities = {
  none: { name: "特性補正なし", englishName: "", condition: "", multiplier: 1 },
  swiftSwim: {
    name: "すいすい",
    englishName: "Swift Swim",
    condition: "雨・×2",
    multiplier: 2,
  },
  chlorophyll: {
    name: "ようりょくそ",
    englishName: "Chlorophyll",
    condition: "晴れ・×2",
    multiplier: 2,
  },
  sandRush: {
    name: "すなかき",
    englishName: "Sand Rush",
    condition: "砂嵐・×2",
    multiplier: 2,
  },
  slushRush: {
    name: "ゆきかき",
    englishName: "Slush Rush",
    condition: "雪・×2",
    multiplier: 2,
  },
  unburden: {
    name: "かるわざ",
    englishName: "Unburden",
    condition: "持ち物を失った後・×2",
    multiplier: 2,
  },
  surgeSurfer: {
    name: "サーフテール",
    englishName: "Surge Surfer",
    condition: "エレキフィールド・×2",
    multiplier: 2,
  },
  quickFeet: {
    name: "はやあし",
    englishName: "Quick Feet",
    condition: "状態異常・×1.5",
    multiplier: 1.5,
  },
  slowStart: {
    name: "スロースタート",
    englishName: "Slow Start",
    condition: "発動中・×0.5",
    multiplier: 0.5,
  },
};
export type SpeedAbility = keyof typeof speedAbilities;
export function availableSpeedAbilities(species: SpeedSpecies): SpeedAbility[] {
  return (Object.keys(speedAbilities) as SpeedAbility[]).filter(
    (key) =>
      key !== "none" &&
      species.abilities.includes(speedAbilities[key].englishName),
  );
}
export function resolveSpeedConfig(
  species: SpeedSpecies,
  config: SpeedConfig,
): SpeedConfig {
  const ability =
    config.ability && availableSpeedAbilities(species).includes(config.ability)
      ? config.ability
      : "none";
  return {
    ...config,
    ability,
    scarf: config.scarf && !species.mega && ability !== "unburden",
  };
}
export const speedPresets = {
  fastest: {
    label: "最速",
    detail: "上昇補正・32 SP",
    points: 32,
    nature: "up",
    scarf: false,
    stage: 0,
  },
  max: {
    label: "準速",
    detail: "補正なし・32 SP",
    points: 32,
    nature: "neutral",
    scarf: false,
    stage: 0,
  },
  zero: {
    label: "無振り",
    detail: "補正なし・0 SP",
    points: 0,
    nature: "neutral",
    scarf: false,
    stage: 0,
  },
  slowest: {
    label: "最遅",
    detail: "下降補正・0 SP",
    points: 0,
    nature: "down",
    scarf: false,
    stage: 0,
  },
  scarf: {
    label: "最速スカーフ",
    detail: "上昇補正・32 SP・×1.5",
    points: 32,
    nature: "up",
    scarf: true,
    stage: 0,
  },
} satisfies Record<string, SpeedConfig & { label: string; detail: string }>;
export type SpeedPreset = keyof typeof speedPresets;

// Champions: floor((base + SP + 20) × nature). No level or IV inputs.
export function calculateSpeed(base: number, config: SpeedConfig): number {
  if (
    !Number.isInteger(base) ||
    base <= 0 ||
    !Number.isInteger(config.points) ||
    config.points < 0 ||
    config.points > 32 ||
    !Number.isInteger(config.stage) ||
    Math.abs(config.stage) > 6
  )
    throw new RangeError("Invalid speed configuration");
  const nature =
    config.nature === "up" ? 110 : config.nature === "down" ? 90 : 100;
  let speed = Math.floor(((base + config.points + 20) * nature) / 100);
  speed = Math.floor(
    speed *
      (config.stage >= 0 ? (2 + config.stage) / 2 : 2 / (2 - config.stage)),
  );
  const ability = config.ability ?? "none";
  // Ability and item modifiers are chained before Pokémon's half-down rounding.
  // Unburden requires no held item, so a Choice Scarf cannot remain active.
  const modifier =
    speedAbilities[ability].multiplier *
    (config.scarf && ability !== "unburden" ? 1.5 : 1);
  return Math.max(1, Math.floor((speed * modifier * 4096 + 2047) / 4096));
}

export function compareSpeeds(
  roster: SpeedSpecies[],
  selectedId: string,
  value: number,
  preset: SpeedPreset,
  conditions: { stage: number; ability: SpeedAbility } = {
    stage: 0,
    ability: "none",
  },
) {
  return roster
    .filter((p) => p.id !== selectedId)
    .map((p) => {
      const appliedConfig = resolveSpeedConfig(p, {
        ...speedPresets[preset],
        ...conditions,
      });
      return {
        ...p,
        appliedConfig,
        speed: calculateSpeed(p.baseSpeed, appliedConfig),
      };
    })
    .map((p) => ({ ...p, difference: p.speed - value }))
    .sort(
      (a, b) =>
        b.speed - a.speed || a.number - b.number || a.id.localeCompare(b.id),
    );
}
export type SpeedPresetFilter = SpeedPreset | "all";
export type SpeedStageFilter = 0 | 1 | 2 | "all";

// One row per species, representative build and reachable rank.
export function compareSpeedBuilds(
  roster: SpeedSpecies[],
  selectedId: string,
  value: number,
  filter: SpeedPresetFilter = "all",
  conditions: { stage: SpeedStageFilter; ability: SpeedAbility } = {
    stage: "all",
    ability: "none",
  },
) {
  const presets =
    filter === "all" ? (Object.keys(speedPresets) as SpeedPreset[]) : [filter];
  const stages = conditions.stage === "all" ? [0, 1, 2] : [conditions.stage];
  return presets
    .flatMap((preset) =>
      stages.flatMap((stage) =>
        compareSpeeds(roster, selectedId, value, preset, {
          ...conditions,
          stage,
        })
          .filter((p) => preset !== "scarf" || p.appliedConfig.scarf)
          .map((p) => ({
            ...p,
            rankSources: speedRankSources(
              p,
              p.appliedConfig,
              speedAbilities[p.appliedConfig.ability ?? "none"].englishName,
            ),
            preset,
            rowId: `${p.id}:${preset}:${stage}`,
          }))
          .filter((p) => stage === 0 || p.rankSources.length > 0),
      ),
    )
    .sort(
      (a, b) =>
        b.speed - a.speed ||
        a.number - b.number ||
        a.id.localeCompare(b.id) ||
        presets.indexOf(a.preset) - presets.indexOf(b.preset) ||
        a.appliedConfig.stage - b.appliedConfig.stage,
    );
}

export function normalizePokemonSearch(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
