import fs from "node:fs/promises";
import crypto from "node:crypto";
import { format } from "prettier";

const csvUrl =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv";
const imageRoot =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/";
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
const csv = process.argv[2]
  ? await fs.readFile(process.argv[2])
  : await fetchBytes(csvUrl);
const rows = csv
  .toString()
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(","));
const ids = new Map(rows.map((row) => [normalize(row[1]), row[0]]));
const aliases = JSON.parse(
  await fs.readFile("scripts/artwork-aliases.json", "utf8"),
);
const supplements = JSON.parse(
  await fs.readFile("scripts/artwork-supplements.json", "utf8"),
);
const roster = JSON.parse(
  await fs.readFile("src/generated/battle-catalog.json", "utf8"),
).pokemon;
let previous = {};
try {
  previous = JSON.parse(
    await fs.readFile("src/generated/artwork.json", "utf8"),
  ).artwork;
} catch {}
const artwork = {};
const missing = [];
await fs.mkdir("public/pokemon/artwork", { recursive: true });
let next = 0;
let completed = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (next < roster.length) {
      const p = roster[next++];
      try {
        const pokeapiId = ids.get(
          normalize(aliases[p.speciesId] ?? p.speciesId),
        );
        const supplement = supplements[p.speciesId];
        if (!pokeapiId && !supplement) throw new Error("No artwork mapping");
        const url = supplement?.url ?? `${imageRoot}${pokeapiId}.png`;
        const local = `/pokemon/artwork/${p.speciesId}.png`;
        const file = `public${local}`;
        let bytes;
        try {
          if (previous[p.speciesId] && previous[p.speciesId].source !== url)
            throw new Error("Source changed");
          bytes = await fs.readFile(file);
          if (
            previous[p.speciesId] &&
            previous[p.speciesId].sha256 !== sha256(bytes)
          )
            throw new Error("Cache changed");
        } catch {
          bytes = await fetchBytes(url);
        }
        if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
          throw new Error("Artwork is not PNG");
        const width = bytes.readUInt32BE(16),
          height = bytes.readUInt32BE(20);
        if (width < 100 || height < 100)
          throw new Error("Artwork is unexpectedly small");
        await fs.writeFile(file, bytes);
        artwork[p.speciesId] = {
          path: local,
          source: url,
          ...(supplement
            ? { note: supplement.note }
            : { pokeapiId: Number(pokeapiId) }),
          width,
          height,
          sha256: sha256(bytes),
        };
        completed++;
        if (completed % 50 === 0)
          console.log(`${completed}/${roster.length} artwork files verified`);
      } catch (error) {
        missing.push(`${p.speciesId}: ${error.message}`);
      }
    }
  }),
);
if (missing.length) throw new Error(`Missing artwork:\n${missing.join("\n")}`);
await fs.writeFile(
  "src/generated/artwork.json",
  await format(
    JSON.stringify({
      retrievedAt: new Date().toISOString().slice(0, 10),
      catalog: { source: csvUrl, sha256: sha256(csv) },
      artwork: Object.fromEntries(
        Object.entries(artwork).sort(([a], [b]) => a.localeCompare(b)),
      ),
    }),
    { parser: "json" },
  ),
);
console.log(`Generated ${completed} artwork mappings`);
