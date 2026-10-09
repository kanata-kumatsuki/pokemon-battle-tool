import fs from "node:fs/promises";
import crypto from "node:crypto";
import ts from "typescript";
import { Generations, toID, Move } from "@smogon/calc";
import { format } from "prettier";
const sources = {
  learnsets:
    "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/learnsets.ts",
  effects:
    "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts",
  moves:
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_names.csv",
  abilities:
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/ability_names.csv",
  items:
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/item_names.csv",
};
const localFiles = {
  learnsets: "champions-learnsets.ts",
  effects: "battle-note-moves.ts",
  moves: "move_names.csv",
  abilities: "ability_names.csv",
  items: "item_names.csv",
};
const content = {};
for (const [key, url] of Object.entries(sources)) {
  if (process.argv[2])
    content[key] = await fs.readFile(
      `${process.argv[2]}/${localFiles[key]}`,
      "utf8",
    );
  else {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    content[key] = await r.text();
  }
}
function literal(n) {
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n))
    return ts.isNumericLiteral(n) ? Number(n.text) : n.text;
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken)
    return -literal(n.operand);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isObjectLiteralExpression(n))
    return Object.fromEntries(
      n.properties
        .filter(ts.isPropertyAssignment)
        .map((p) => [p.name.text, literal(p.initializer)]),
    );
}
function table(s) {
  const a = ts.createSourceFile("data.ts", s, ts.ScriptTarget.Latest, true);
  return literal(
    a.statements.find(ts.isVariableStatement).declarationList.declarations[0]
      .initializer,
  );
}
const learnsets = table(content.learnsets),
  effects = table(content.effects);
function translations(s) {
  const rows = s
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => {
      const [id, lang, ...name] = l.split(",");
      return { id, lang, name: name.join(",").replace(/^"|"$/g, "") };
    });
  const ja = new Map(
    rows.filter((r) => r.lang === "1").map((r) => [r.id, r.name]),
  );
  return Object.fromEntries(
    rows
      .filter((r) => r.lang === "9" && ja.has(r.id))
      .map((r) => [toID(r.name), ja.get(r.id)]),
  );
}
const ja = {
  moves: translations(content.moves),
  abilities: translations(content.abilities),
  items: translations(content.items),
};
sources.abilityNamesSupplement = "src/localization/abilities.ja.json";
content.abilityNamesSupplement = await fs.readFile(
  sources.abilityNamesSupplement,
  "utf8",
);
const abilitySupplement = JSON.parse(content.abilityNamesSupplement).names;
for (const [id, name] of Object.entries(abilitySupplement))
  ja.abilities[id] ??= name;
// Calculator-only sentinel, not a learnable move.
ja.moves.nomove = "わざなし";
const gen = Generations.get(0),
  roster = JSON.parse(
    await fs.readFile("src/generated/speed-roster.json", "utf8"),
  ).pokemon;
const moves = Object.fromEntries(
  [...gen.moves].map((m) => [
    m.id,
    {
      name: ja.moves[m.id] ?? m.name,
      englishName: m.name,
      type: (m.type ?? effects[m.id]?.type ?? "Normal").toLowerCase(),
      category: m.category ?? effects[m.id]?.category ?? "Status",
      power: m.basePower ?? 0,
      priority: new Move(gen, m.name).priority,
      heal: !!(effects[m.id]?.heal || effects[m.id]?.drain),
      statEffect: effects[m.id]?.boosts
        ? {
            target: effects[m.id].target ?? "unknown",
            stages: effects[m.id].boosts,
          }
        : null,
      pivot: !!effects[m.id]?.selfSwitch,
      status: effects[m.id]?.status ?? "",
      accuracy: effects[m.id]?.accuracy ?? true,
      multihit: effects[m.id]?.multihit ?? null,
    },
  ]),
);
// Preserve original numeric identifiers so v1 backups remain readable.
const pokemon = roster.map((p) => {
  const calcId = p.id === "aegislash" ? "aegislashshield" : p.id;
  const s = gen.species.get(calcId);
  if (!s) throw new Error(`Missing species ${p.id}`);
  const base = toID(s.baseSpecies ?? s.name.split("-")[0]);
  const learn = learnsets[p.id]?.learnset ?? learnsets[base]?.learnset;
  if (!learn) throw new Error(`Missing learnset ${p.id} / ${base}`);
  const numeric =
    p.id === "rotomwash"
      ? 10009
      : p.englishName.includes("-")
        ? 100000 +
          parseInt(
            crypto.createHash("sha256").update(p.id).digest("hex").slice(0, 7),
            16,
          )
        : p.number;
  return {
    ...p,
    id: numeric,
    speciesId: p.id,
    calcName: s.name,
    number: String(p.number).padStart(4, "0"),
    stats: ["hp", "atk", "def", "spa", "spd", "spe"].map((k) => s.baseStats[k]),
    abilities: p.abilities.map((a) => ja.abilities[toID(a)] ?? a),
    learnset: Object.keys(learn).filter((id) => moves[id]),
    moves: [],
  };
});
if (new Set(pokemon.map((p) => p.id)).size !== pokemon.length)
  throw new Error("Duplicate numeric species IDs");
const abilityNames = new Set([
  ...[...gen.abilities].map((a) => a.name),
  ...roster.flatMap((p) => p.abilities),
]);
const abilities = Object.fromEntries(
  [...abilityNames].map((name) => [
    toID(name),
    { name: ja.abilities[toID(name)] ?? name, englishName: name },
  ]),
);
// Supplement names missing from PokeAPI without inventing translations.
sources.itemNamesSupplement = "src/localization/items.ja.json";
content.itemNamesSupplement = await fs.readFile(
  sources.itemNamesSupplement,
  "utf8",
);
const itemSupplement = JSON.parse(content.itemNamesSupplement).names;
const items = Object.fromEntries(
  [...gen.items].map((i) => [
    i.id,
    {
      name: ja.items[i.id] ?? itemSupplement[i.id],
      englishName: i.name,
      megaStone: i.megaStone ?? null,
    },
  ]),
);
const isJapaneseName = (name) =>
  typeof name === "string" &&
  /[ぁ-んァ-ヶ一-龯]/u.test(name) &&
  (!/[a-z]{2,}/i.test(name.normalize("NFKC")) ||
    name.normalize("NFKC") === "DDラリアット");
for (const [category, entries] of Object.entries({ abilities, items, moves })) {
  for (const [id, entry] of Object.entries(entries)) {
    if (!isJapaneseName(entry.name))
      throw new Error(`Missing Japanese ${category} name: ${id}`);
  }
}
for (const p of pokemon) {
  for (const name of p.abilities) {
    if (!isJapaneseName(name))
      throw new Error(`Missing Japanese ability for ${p.speciesId}: ${name}`);
  }
}
await fs.writeFile(
  "src/generated/battle-catalog.json",
  await format(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      calcVersion: "0.12.0",
      supportedSeason: "M6",
      sources,
      sha256: Object.fromEntries(
        Object.entries(content).map(([k, v]) => [
          k,
          crypto.createHash("sha256").update(v).digest("hex"),
        ]),
      ),
      pokemon,
      moves,
      abilities,
      items,
    }),
    { parser: "json" },
  ),
);
console.log(
  `Generated ${pokemon.length} species, ${Object.keys(moves).length} moves`,
);
