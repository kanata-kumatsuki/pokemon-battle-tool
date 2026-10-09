import { getPokemon, japaneseItem, type Party } from "./data.ts";

function sameBuild(
  left: Party["members"][number],
  right: Party["members"][number],
): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.pokemonId === right.pokemonId &&
    left.nature === right.nature &&
    left.ability === right.ability &&
    left.item === right.item &&
    left.points.length === right.points.length &&
    left.points.every((value, index) => value === right.points[index]) &&
    left.moves.length === right.moves.length &&
    left.moves.every((value, index) => value === right.moves[index])
  );
}

/** Compare an edited party with its saved version by the values that are stored. */
export function partyHasChanges(draft: Party, saved: Party): boolean {
  return (
    draft.name !== saved.name ||
    draft.members.length !== saved.members.length ||
    draft.members.some(
      (member, index) => !sameBuild(member, saved.members[index]),
    )
  );
}

/** Validate the edited party before replacing its saved version. */
export function duplicateItemWarning(party: Party): string {
  const holders = new Map<string, string[]>();
  party.members.forEach((member, index) => {
    if (!member) return;
    const item = japaneseItem(member.item) ?? member.item;
    if (!item || item === "もちものなし") return;
    const names = holders.get(item) ?? [];
    names.push(`${index + 1}枠目の${getPokemon(member.pokemonId).name}`);
    holders.set(item, names);
  });
  const duplicates = [...holders]
    .filter(([, names]) => names.length > 1)
    .map(([item, names]) => `${item}（${names.join("・")}）`);
  return duplicates.length
    ? `もちものが重複しています。${duplicates.join("、")}。もちものを変更してから保存してください。`
    : "";
}

/** Validate every party before saving a complete edited party set. */
export function partySaveErrors(
  parties: Party[],
  partyIndexes: number[] = parties.map((_, index) => index),
): string[] {
  return partyIndexes.flatMap((index) => {
    const party = parties[index];
    if (!party) return [];
    const partyLabel = `パーティ${index + 1}${party.name.trim() ? `「${party.name.trim()}」` : ""}`;
    const errors: string[] = [];
    if (!party.name.trim())
      errors.push(`${partyLabel}の名前を入力してください。`);
    const duplicateWarning = duplicateItemWarning(party);
    if (duplicateWarning) errors.push(`${partyLabel}：${duplicateWarning}`);
    return errors;
  });
}
