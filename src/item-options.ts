import { itemsForPokemon, japaneseItem, type Pokemon } from "./data.ts";
import { usageCompatible, type UsageSnapshot, type UsageRow } from "./usage.ts";

const japaneseNames = new Intl.Collator("ja");

export function itemOptions(pokemon: Pokemon, usage?: UsageSnapshot) {
  const allowed = itemsForPokemon(pokemon);
  const rows =
    usage && usageCompatible(usage) && usage.speciesId === pokemon.speciesId
      ? usage.rows.filter((row) => row.category === "held_item")
      : [];
  const adoption = new Map<string, UsageRow>();
  for (const row of rows) {
    const name = japaneseItem(row.name);
    if (name && name !== "もちものなし" && allowed.includes(name)) {
      const previous = adoption.get(name);
      if (!previous || row.rank < previous.rank) adoption.set(name, row);
    }
  }
  // If any percentage is missing, use the source's ranks consistently.
  const usePercent =
    adoption.size > 0 &&
    [...adoption.values()].every((row) => row.percent !== null);
  const options = allowed.map((name) => ({ name, usage: adoption.get(name) }));
  options.sort((a, b) => {
    if (a.name === b.name) return 0;
    if (a.name === "もちものなし") return -1;
    if (b.name === "もちものなし") return 1;
    if (a.usage && b.usage) {
      return (
        (usePercent ? b.usage.percent! - a.usage.percent! : 0) ||
        a.usage.rank - b.usage.rank ||
        japaneseNames.compare(a.name, b.name)
      );
    }
    if (a.usage) return -1;
    if (b.usage) return 1;
    return japaneseNames.compare(a.name, b.name);
  });
  return { options, hasUsage: adoption.size > 0, usePercent };
}
