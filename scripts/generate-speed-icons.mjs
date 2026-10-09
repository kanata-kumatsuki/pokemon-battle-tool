import fs from "node:fs/promises";
import crypto from "node:crypto";
import ts from "typescript";
import { format } from "prettier";

const sources = {
  indexes:
    "https://raw.githubusercontent.com/smogon/pokemon-showdown-client/master/play.pokemonshowdown.com/src/battle-dex-data.ts",
  sheet: "https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png",
};
async function input(url, localPath) {
  if (localPath) return fs.readFile(localPath);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const source = await input(sources.indexes, process.argv[2]);
const sheet = await input(sources.sheet, process.argv[3]);
const ast = ts.createSourceFile(
  "icons.ts",
  source.toString(),
  ts.ScriptTarget.Latest,
  true,
);
const declaration = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((s) => [...s.declarationList.declarations])
  .find((d) => d.name.getText(ast) === "BattlePokemonIconIndexes");
// Parse only numeric literals and sums; never execute downloaded code.
function number(node) {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  )
    return number(node.left) + number(node.right);
  throw new Error("Unexpected icon index expression");
}
if (!declaration || !ts.isObjectLiteralExpression(declaration.initializer))
  throw new Error("Missing icon index table");
const indexes = Object.fromEntries(
  declaration.initializer.properties.map((p) => {
    if (!ts.isPropertyAssignment(p))
      throw new Error("Unexpected icon property");
    return [p.name.text, number(p.initializer)];
  }),
);
if (sheet.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
  throw new Error("Icon sheet is not PNG");
const width = sheet.readUInt32BE(16),
  height = sheet.readUInt32BE(20);
if (width !== 480 || height % 30 !== 0)
  throw new Error("Unexpected icon sheet dimensions");
const roster = JSON.parse(
  await fs.readFile("src/generated/speed-roster.json", "utf8"),
).pokemon;
const icons = Object.fromEntries(
  roster.map((p) => {
    const index = indexes[p.id] ?? p.number;
    if (
      !Number.isInteger(index) ||
      index <= 0 ||
      index >= (width / 40) * (height / 30)
    )
      throw new Error(`Invalid icon index for ${p.id}`);
    return [p.id, index];
  }),
);
await fs.writeFile("public/pokemon/icons-sheet.png", sheet);
await fs.writeFile(
  "src/generated/speed-icons.json",
  await format(
    JSON.stringify({
      retrievedAt: new Date().toISOString().slice(0, 10),
      sources,
      sha256: {
        indexes: crypto.createHash("sha256").update(source).digest("hex"),
        sheet: crypto.createHash("sha256").update(sheet).digest("hex"),
      },
      icons,
    }),
    { parser: "json" },
  ),
);
console.log(`Generated ${roster.length} icons from ${width} × ${height} sheet`);
