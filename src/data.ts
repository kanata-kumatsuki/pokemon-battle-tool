import catalog from "./generated/battle-catalog.json" with { type: "json" };
export const statLabels = [
  "HP",
  "こうげき",
  "ぼうぎょ",
  "とくこう",
  "とくぼう",
  "すばやさ",
];
export const statShort = ["H", "A", "B", "C", "D", "S"];
export const typeNames: Record<string, string> = {
  dragon: "ドラゴン",
  ground: "じめん",
  steel: "はがね",
  ghost: "ゴースト",
  flying: "ひこう",
  water: "みず",
  electric: "でんき",
  fairy: "フェアリー",
  fire: "ほのお",
  bug: "むし",
  poison: "どく",
  normal: "ノーマル",
  dark: "あく",
  psychic: "エスパー",
  grass: "くさ",
  rock: "いわ",
  fighting: "かくとう",
  ice: "こおり",
};
export type Pokemon = {
  id: number;
  name: string;
  number: string;
  types: string[];
  stats: number[];
  abilities: string[];
  moves: [string, string][];
  speciesId?: string;
  calcName?: string;
  learnset?: string[];
  mega?: boolean;
};
const templates: Pokemon[] = [
  {
    id: 445,
    name: "ガブリアス",
    number: "0445",
    types: ["dragon", "ground"],
    stats: [108, 130, 95, 80, 85, 102],
    abilities: ["さめはだ", "すながくれ"],
    moves: [
      ["じしん", "ground"],
      ["ドラゴンクロー", "dragon"],
      ["つるぎのまい", "normal"],
      ["ステルスロック", "ground"],
    ],
  },
  {
    id: 1000,
    name: "サーフゴー",
    number: "1000",
    types: ["steel", "ghost"],
    stats: [87, 60, 95, 133, 91, 84],
    abilities: ["おうごんのからだ"],
    moves: [
      ["ゴールドラッシュ", "steel"],
      ["シャドーボール", "ghost"],
      ["わるだくみ", "dark"],
      ["じこさいせい", "normal"],
    ],
  },
  {
    id: 149,
    name: "カイリュー",
    number: "0149",
    types: ["dragon", "flying"],
    stats: [91, 134, 95, 100, 100, 80],
    abilities: ["マルチスケイル", "せいしんりょく"],
    moves: [
      ["しんそく", "normal"],
      ["じしん", "ground"],
      ["りゅうのまい", "dragon"],
      ["はねやすめ", "flying"],
    ],
  },
  {
    id: 778,
    name: "ミミッキュ",
    number: "0778",
    types: ["ghost", "fairy"],
    stats: [55, 90, 80, 50, 105, 96],
    abilities: ["ばけのかわ"],
    moves: [
      ["じゃれつく", "fairy"],
      ["かげうち", "ghost"],
      ["つるぎのまい", "normal"],
      ["シャドークロー", "ghost"],
    ],
  },
  {
    id: 10009,
    name: "ウォッシュロトム",
    number: "0479",
    types: ["electric", "water"],
    stats: [50, 65, 107, 105, 107, 86],
    abilities: ["ふゆう"],
    moves: [
      ["ハイドロポンプ", "water"],
      ["ボルトチェンジ", "electric"],
      ["おにび", "fire"],
      ["１０まんボルト", "electric"],
    ],
  },
  {
    id: 823,
    name: "アーマーガア",
    number: "0823",
    types: ["flying", "steel"],
    stats: [98, 87, 105, 53, 85, 67],
    abilities: ["ミラーアーマー", "プレッシャー"],
    moves: [
      ["ブレイブバード", "flying"],
      ["とんぼがえり", "bug"],
      ["はねやすめ", "flying"],
      ["てっぺき", "steel"],
    ],
  },
  {
    id: 637,
    name: "ウルガモス",
    number: "0637",
    types: ["bug", "fire"],
    stats: [85, 60, 65, 135, 105, 100],
    abilities: ["ほのおのからだ"],
    moves: [
      ["ほのおのまい", "fire"],
      ["むしのさざめき", "bug"],
      ["ちょうのまい", "bug"],
      ["ギガドレイン", "grass"],
    ],
  },
  {
    id: 373,
    name: "ボーマンダ",
    number: "0373",
    types: ["dragon", "flying"],
    stats: [95, 135, 80, 110, 80, 100],
    abilities: ["いかく", "じしんかじょう"],
    moves: [
      ["すてみタックル", "normal"],
      ["じしん", "ground"],
      ["りゅうのまい", "dragon"],
      ["はねやすめ", "flying"],
    ],
  },
  {
    id: 730,
    name: "アシレーヌ",
    number: "0730",
    types: ["water", "fairy"],
    stats: [80, 74, 74, 126, 116, 60],
    abilities: ["げきりゅう", "うるおいボイス"],
    moves: [
      ["ムーンフォース", "fairy"],
      ["うたかたのアリア", "water"],
      ["アクアジェット", "water"],
      ["めいそう", "psychic"],
    ],
  },
  {
    id: 450,
    name: "カバルドン",
    number: "0450",
    types: ["ground"],
    stats: [108, 112, 118, 68, 72, 47],
    abilities: ["すなおこし", "すなのちから"],
    moves: [
      ["じしん", "ground"],
      ["あくび", "normal"],
      ["ステルスロック", "ground"],
      ["なまける", "normal"],
    ],
  },
  {
    id: 6,
    name: "リザードン",
    number: "0006",
    types: ["fire", "flying"],
    stats: [78, 84, 78, 109, 85, 100],
    abilities: ["もうか", "サンパワー"],
    moves: [
      ["かえんほうしゃ", "fire"],
      ["エアスラッシュ", "flying"],
      ["りゅうのはどう", "dragon"],
      ["はねやすめ", "flying"],
    ],
  },
  {
    id: 94,
    name: "ゲンガー",
    number: "0094",
    types: ["ghost", "poison"],
    stats: [60, 65, 60, 130, 75, 110],
    abilities: ["のろわれボディ"],
    moves: [
      ["シャドーボール", "ghost"],
      ["ヘドロばくだん", "poison"],
      ["おにび", "fire"],
      ["みちづれ", "ghost"],
    ],
  },
];
export const moveCatalog: Record<
  string,
  {
    name: string;
    englishName: string;
    type: string;
    category: string;
    power: number;
    priority: number;
    heal: boolean;
    statEffect?: { target: string; stages: Record<string, number> } | null;
    pivot: boolean;
    status: string;
    accuracy: number | boolean;
    multihit: number | number[] | null;
  }
> = catalog.moves;
export const abilityCatalog: Record<
  string,
  { name: string; englishName: string }
> = catalog.abilities;
export const itemCatalog: Record<
  string,
  {
    name: string;
    englishName: string;
    megaStone: Record<string, string> | null;
  }
> = catalog.items;
export const supportedSeason = catalog.supportedSeason;
export const normalizeId = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]/g, "");
export const moveByName = (name: string) =>
  Object.entries(moveCatalog).find(
    ([id, m]) =>
      id === normalizeId(name) ||
      m.name.normalize("NFKC") === name.normalize("NFKC"),
  )?.[1];
export const pokemon: Pokemon[] = catalog.pokemon.map((p) => {
  const old = templates.find((t) => t.id === p.id);
  const available = p.learnset.map((id) => moveCatalog[id]).filter(Boolean);
  const preferred =
    old?.moves
      .map(([name]) => moveByName(name))
      .filter((m) => m && available.includes(m)) ?? [];
  const defaults = [
    ...new Set([
      ...preferred,
      ...available.filter((m) => m.category !== "Status"),
      ...available,
    ]),
  ].slice(0, 4);
  return {
    ...p,
    moves: defaults.map((m) => [m!.name, m!.type] as [string, string]),
  };
});
export function learnableMoves(p: Pokemon): [string, string][] {
  return (p.learnset ?? []).map((id) => [
    moveCatalog[id].name,
    moveCatalog[id].type,
  ]);
}
export function movePairs(build: Build): [string, string][] {
  return build.moves.map((name) => [name, moveByName(name)?.type ?? "normal"]);
}
export const englishAbility = (name: string) =>
  Object.values(abilityCatalog).find(
    (a) => a.name === name || a.englishName === name,
  )?.englishName;
export const japaneseAbility = (name: string) =>
  Object.values(abilityCatalog).find(
    (a) =>
      a.englishName === name ||
      a.name.normalize("NFKC") === name.normalize("NFKC"),
  )?.name;
export const englishItem = (name: string) =>
  name === "もちものなし"
    ? ""
    : Object.values(itemCatalog).find(
        (a) => a.name === name || a.englishName === name,
      )?.englishName;
export const japaneseItem = (name: string) => {
  if (name === "もちものなし") return name;
  return Object.values(itemCatalog).find(
    (item) =>
      item.englishName === name ||
      item.name.normalize("NFKC") === name.normalize("NFKC"),
  )?.name;
};
export const englishNatures: Record<string, string> = {
  ようき: "Jolly",
  いじっぱり: "Adamant",
  ひかえめ: "Modest",
  おくびょう: "Timid",
  ずぶとい: "Bold",
  わんぱく: "Impish",
  しんちょう: "Careful",
  おだやか: "Calm",
  まじめ: "Serious",
  さみしがり: "Lonely",
  ゆうかん: "Brave",
  やんちゃ: "Naughty",
  すなお: "Docile",
  のんき: "Relaxed",
  のうてんき: "Lax",
  おっとり: "Mild",
  れいせい: "Quiet",
  うっかりや: "Rash",
  てれや: "Bashful",
  おとなしい: "Gentle",
  なまいき: "Sassy",
  きまぐれ: "Quirky",
  せっかち: "Hasty",
  むじゃき: "Naive",
  がんばりや: "Hardy",
};
export const getPokemon = (id: number) =>
  pokemon.find((p) => p.id === id) ?? pokemon[0];
export const artwork = (speciesId: string) =>
  `/pokemon/artwork/${speciesId}.png`;
// A directly selected Mega form may use only the statistics of its explicitly
// paired pre-Mega form. The pair comes from the catalog's Mega Stone mapping;
// ambiguous mappings are deliberately left unsupported.
const megaUsageSources = (() => {
  const candidates = new Map<number, Set<number>>();
  for (const item of Object.values(itemCatalog)) {
    for (const [baseName, megaName] of Object.entries(item.megaStone ?? {})) {
      const base = pokemon.find((p) => !p.mega && p.calcName === baseName);
      const mega = pokemon.find((p) => p.mega && p.calcName === megaName);
      if (!base || !mega) continue;
      const sources = candidates.get(mega.id) ?? new Set<number>();
      sources.add(base.id);
      candidates.set(mega.id, sources);
    }
  }
  return new Map(
    [...candidates]
      .filter(([, sourceIds]) => sourceIds.size === 1)
      .map(([megaId, sourceIds]) => [megaId, [...sourceIds][0]]),
  );
})();
export function usageSourcePokemon(id: number): Pokemon | undefined {
  const selected = getPokemon(id);
  if (!selected.mega) return selected;
  const sourceId = megaUsageSources.get(selected.id);
  return sourceId === undefined ? undefined : getPokemon(sourceId);
}
// A matching Mega Stone determines the effective battle form; keep the saved base build intact.
export function pokemonAppearance(id: number, heldItem?: string): Pokemon {
  const base = getPokemon(id);
  if (base.mega || !heldItem) return base;
  const localizedItem = japaneseItem(heldItem);
  const item = Object.values(itemCatalog).find(
    (item) => item.name === localizedItem,
  );
  const target = item?.megaStone?.[base.calcName ?? ""];
  if (!target) return base;
  return pokemon.find((p) => p.calcName === target) ?? base;
}
export type Build = {
  pokemonId: number;
  nature: string;
  ability: string;
  item: string;
  points: number[];
  moves: string[];
};
export function resolveBattleBuild(build: Build): Build {
  const form = pokemonAppearance(build.pokemonId, build.item);
  if (form.id === build.pokemonId) return build;
  return { ...build, pokemonId: form.id, ability: form.abilities[0] };
}
const originalNatures = [
  "ようき",
  "いじっぱり",
  "ひかえめ",
  "おくびょう",
  "ずぶとい",
  "わんぱく",
  "しんちょう",
  "おだやか",
  "まじめ",
];
export const natures = [
  ...new Set([...originalNatures, ...Object.keys(englishNatures)]),
];
const natureStats: Record<string, [number, number]> = {
  ようき: [5, 3],
  いじっぱり: [1, 3],
  ひかえめ: [3, 1],
  おくびょう: [5, 1],
  ずぶとい: [2, 1],
  わんぱく: [2, 3],
  しんちょう: [4, 3],
  おだやか: [4, 1],
  さみしがり: [1, 2],
  ゆうかん: [1, 5],
  やんちゃ: [1, 4],
  のんき: [2, 5],
  のうてんき: [2, 4],
  おっとり: [3, 2],
  れいせい: [3, 5],
  うっかりや: [3, 4],
  おとなしい: [4, 2],
  なまいき: [4, 5],
  せっかち: [5, 2],
  むじゃき: [5, 4],
};
export function getNatureModifier(nature: string, statIndex: number) {
  const stats = natureStats[nature];
  if (stats?.[0] === statIndex) return "up";
  if (stats?.[1] === statIndex) return "down";
  return "neutral";
}
export const items = [
  "もちものなし",
  ...Object.values(itemCatalog).map((i) => i.name),
];
// Species-specific held effects, as defined in Showdown data/items.ts.
const exclusiveItemSpecies: Record<string, string[]> = {
  lightball: ["pikachu"],
  leek: ["farfetchd", "farfetchdgalar", "sirfetchd"],
};
export function itemsForPokemon(p: Pokemon): string[] {
  // Mega forms are selected directly; the calculator accepts no extra held item.
  if (p.mega) return ["もちものなし"];
  const species = normalizeId(p.calcName ?? "");
  return [
    "もちものなし",
    ...Object.entries(itemCatalog)
      .filter(([id, item]) => {
        if (item.megaStone)
          return Object.keys(item.megaStone).some(
            (name) => normalizeId(name) === species,
          );
        return (
          !exclusiveItemSpecies[id] ||
          exclusiveItemSpecies[id].includes(species)
        );
      })
      .map(([, item]) => item.name),
  ];
}
export function makeBuild(id: number): Build {
  const p = getPokemon(id);
  return {
    pokemonId: id,
    nature: id === 1000 ? "ひかえめ" : "ようき",
    ability:
      templates
        .find((t) => t.id === id)
        ?.abilities.find((a) => p.abilities.includes(a)) ?? p.abilities[0],
    item: p.mega
      ? "もちものなし"
      : id === 1000
        ? "たべのこし"
        : "きあいのタスキ",
    points: id === 1000 ? [32, 0, 0, 32, 0, 2] : [2, 32, 0, 0, 0, 32],
    moves: p.moves.map((m) => m[0]),
  };
}
export type Party = { name: string; members: (Build | null)[] };
export type SavedData = {
  version: 1;
  parties: Party[];
  attackHistory: Build[];
  defenseHistory: Build[];
};
export const initialData = (): SavedData => ({
  version: 1,
  parties: [
    {
      name: "スタンダード",
      members: [445, 149, 1000, 10009, 778, 823].map(makeBuild),
    },
    { name: "パーティ 2", members: Array(6).fill(null) },
    { name: "パーティ 3", members: Array(6).fill(null) },
  ],
  attackHistory: [],
  defenseHistory: [],
});
export function addHistory(history: Build[], build: Build) {
  const key = JSON.stringify(build);
  return [
    structuredClone(build),
    ...history.filter((b) => JSON.stringify(b) !== key),
  ].slice(0, 6);
}
export function validateSavedData(value: unknown): value is SavedData {
  const isBuild = (b: unknown): b is Build => {
    if (!b || typeof b !== "object") return false;
    const x = b as Build;
    const p = pokemon.find((p) => p.id === x.pokemonId);
    return (
      !!p &&
      natures.includes(x.nature) &&
      p.abilities.includes(x.ability) &&
      items.includes(x.item) &&
      Array.isArray(x.points) &&
      x.points.length === 6 &&
      x.points.every((n) => Number.isInteger(n) && n >= 0 && n <= 32) &&
      x.points.reduce((a, b) => a + b, 0) <= 66 &&
      Array.isArray(x.moves) &&
      x.moves.length <= 4 &&
      x.moves.every(
        (m) =>
          typeof m === "string" &&
          learnableMoves(p).some(
            ([name]) => name.normalize("NFKC") === m.normalize("NFKC"),
          ),
      ) &&
      new Set(x.moves).size === x.moves.length
    );
  };
  if (!value || typeof value !== "object") return false;
  const x = value as SavedData;
  return (
    x.version === 1 &&
    Array.isArray(x.parties) &&
    x.parties.length === 3 &&
    x.parties.every(
      (p) =>
        p &&
        typeof p.name === "string" &&
        p.name.length <= 24 &&
        Array.isArray(p.members) &&
        p.members.length === 6 &&
        p.members.every((b) => b === null || isBuild(b)),
    ) &&
    [x.attackHistory, x.defenseHistory].every(
      (h) => Array.isArray(h) && h.length <= 6 && h.every(isBuild),
    )
  );
}

// Normalize legacy English labels before strict validation. Keep the source intact.
export function normalizeSavedData(value: unknown): SavedData | null {
  if (!value || typeof value !== "object") return null;
  let copy: SavedData;
  try {
    copy = structuredClone(value) as SavedData;
  } catch {
    return null;
  }
  const normalize = (build: unknown) => {
    if (!build || typeof build !== "object") return;
    const b = build as Build;
    if (typeof b.item === "string") b.item = japaneseItem(b.item) ?? b.item;
    if (typeof b.ability === "string")
      b.ability = japaneseAbility(b.ability) ?? b.ability;
    if (Array.isArray(b.moves))
      b.moves = b.moves.map((name) =>
        typeof name === "string" ? (moveByName(name)?.name ?? name) : name,
      );
  };
  if (Array.isArray(copy.parties)) {
    for (const party of copy.parties) {
      if (party && Array.isArray(party.members))
        party.members.forEach(normalize);
    }
  }
  for (const history of [copy.attackHistory, copy.defenseHistory]) {
    if (Array.isArray(history)) history.forEach(normalize);
  }
  return validateSavedData(copy) ? copy : null;
}
