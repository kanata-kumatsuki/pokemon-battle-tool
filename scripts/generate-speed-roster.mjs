import fs from "node:fs/promises";
import crypto from "node:crypto";
import ts from "typescript";
import { format } from "prettier";

const sources = {
  formats:
    "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/formats-data.ts",
  pokedex:
    "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts",
  names:
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv",
};
const contents = {};
for (const [key, url] of Object.entries(sources)) {
  if (process.argv[2]) {
    contents[key] = await fs.readFile(
      `${process.argv[2]}/${key === "names" ? "names.csv" : `${key}.ts`}`,
      "utf8",
    );
  } else {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    contents[key] = await response.text();
  }
}
// Read literals from the TypeScript AST; never execute downloaded source.
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  )
    return -literal(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties
        .filter(ts.isPropertyAssignment)
        .map((p) => [p.name.text, literal(p.initializer)]),
    );
  return undefined;
}
function table(text) {
  const file = ts.createSourceFile(
    "source.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const statement = file.statements.find(ts.isVariableStatement);
  return literal(statement.declarationList.declarations[0].initializer);
}
const formats = table(contents.formats);
const pokedex = table(contents.pokedex);
// Battle/sex forms without their own format row inherit their base form's tier.
// Purely cosmetic forms are represented by their base form.
for (const [id, p] of Object.entries(pokedex)) {
  const base = p.baseSpecies?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    !formats[id] &&
    !p.isCosmeticForme &&
    !p.isNonstandard &&
    base &&
    formats[base]
  ) {
    formats[id] = { ...formats[base] };
  }
}
const names = new Map(
  contents.names
    .split("\n")
    .map((line) => line.split(","))
    .filter((row) => row[1] === "1")
    .map((row) => [Number(row[0]), row[2]]),
);
const formNames = {
  Fancy: "ファンシー",
  Pokeball: "ボール",
  Antique: "しんさく",
  Masterpiece: "タカイモノ",
  F: "メス",
  Eternal: "えいえんのはな",
  Midnight: "まよなか",
  Dusk: "たそがれ",
  Blue: "ブルー",
  Yellow: "イエロー",
  White: "ホワイト",
  Alola: "アローラ",
  Galar: "ガラル",
  Hisui: "ヒスイ",
  Paldea: "パルデア",
  Wash: "ウォッシュ",
  Heat: "ヒート",
  Frost: "フロスト",
  Fan: "スピン",
  Mow: "カット",
  Therian: "れいじゅう",
  Incarnate: "けしん",
  Female: "メス",
  Male: "オス",
  Blade: "ブレード",
  Shield: "シールド",
  School: "むれたすがた",
  Solo: "たんどくのすがた",
  Busted: "ばれたすがた",
  Noice: "ナイスフェイス",
  Hangry: "はらぺこ",
  Hero: "マイティ",
  Zen: "ダルマモード",
  "Galar-Zen": "ガラル・ダルマモード",
  Crowned: "けんのおう／たてのおう",
  Small: "ちいさい",
  Large: "おおきい",
  Super: "とくだい",
  Average: "ふつう",
  "Low-Key": "ロー",
  Amped: "ハイ",
  "Rapid-Strike": "れんげき",
  "Single-Strike": "いちげき",
  Aqua: "ウォーター",
  Blaze: "ブレイズ",
  Combat: "コンバット",
  "Paldea-Aqua": "パルデア・ウォーター",
  "Paldea-Blaze": "パルデア・ブレイズ",
  "Paldea-Combat": "パルデア・コンバット",
  "White-Striped": "しろすじ",
  "Blue-Striped": "あおすじ",
  Droopy: "たれた",
  Stretchy: "のびた",
  "Three-Segment": "みつふし",
  Four: "４ひきかぞく",
  Roaming: "とほ",
  "Gimmighoul-Roaming": "とほ",
  Sunny: "ポジ",
  Rainy: "あまみず",
  Snowy: "ゆきぐも",
  Sunshine: "ポジ",
};
const unknownForms = new Set();
const roster = Object.entries(formats)
  .filter(
    ([, f]) =>
      !f.isNonstandard && f.tier !== "Illegal" && f.tier !== "Unreleased",
  )
  .map(([id]) => {
    const p = pokedex[id];
    if (!p || !names.has(p.num) || !Number.isFinite(p.baseStats?.spe))
      throw new Error(`Missing species data: ${id}`);
    const baseName = names.get(p.num);
    let name = baseName;
    if (p.forme === "M-Mega" || p.forme === "F-Mega")
      name = `メガ${baseName}（${p.forme === "M-Mega" ? "オス" : "メス"}）`;
    else if (p.forme?.startsWith("Mega"))
      name = `メガ${baseName}${p.forme.slice(4).replaceAll("-", "")}`;
    else if (p.forme) {
      if (!formNames[p.forme]) unknownForms.add(p.forme);
      name = `${baseName}（${formNames[p.forme] ?? p.forme}）`;
    }
    return {
      id,
      number: p.num,
      name,
      englishName: p.name,
      baseSpeed: p.baseStats.spe,
      types: p.types.map((t) => t.toLowerCase()),
      mega: Boolean(p.forme?.includes("Mega")),
      abilities: [...new Set(Object.values(p.abilities))],
    };
  })
  .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
const output = {
  retrievedAt: new Date().toISOString().slice(0, 10),
  sources: Object.entries(sources).map(([key, url]) => ({
    url,
    sha256: crypto.createHash("sha256").update(contents[key]).digest("hex"),
  })),
  pokemon: roster,
};
await fs.writeFile(
  new URL("../src/generated/speed-roster.json", import.meta.url),
  await format(JSON.stringify(output), { parser: "json" }),
);
console.log(
  `${roster.length} forms / ${new Set(roster.map((p) => p.number)).size} species. Untranslated forms: ${[...unknownForms].join(", ")}`,
);
