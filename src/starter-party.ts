import {
  getPokemon,
  makeBuild,
  normalizeId,
  pokemon,
  pokemonAppearance,
  usageSourcePokemon,
  type Party,
} from "./data.ts";
import { popularBuild } from "./build-defaults.ts";
import {
  validIndex,
  type CacheEntry,
  type UsageIndex,
  type UsageSnapshot,
} from "./usage.ts";
import type {
  DefaultBuildSelectionGate,
  DefaultBuildTicket,
} from "./build-defaults.ts";
import { partyHasChanges } from "./party-validation.ts";

export type StarterPartyPick = {
  id: number;
  name: string;
  rank: number;
  item: string;
  mega: boolean;
  megaSource: "direct" | "stone" | null;
};

export type SkippedStarterMega = {
  id: number;
  name: string;
  rank: number;
  item: string;
  megaSource: "direct" | "stone";
};

export type StarterPartyResult =
  | {
      ok: true;
      party: Party;
      picks: StarterPartyPick[];
      skippedMegas: SkippedStarterMega[];
    }
  | {
      ok: false;
      reason: "invalid-ranking" | "insufficient-ranked-pokemon";
      selected: number;
    };

type UsageLoader = (speciesId: string) => Promise<CacheEntry<UsageSnapshot>>;

function hasValidRank(rank: unknown): rank is number {
  return Number.isInteger(rank) && Number(rank) > 0;
}

function sourcePokemonId(id: number) {
  return usageSourcePokemon(id)?.id ?? id;
}

function isMegaBuild(build: ReturnType<typeof makeBuild>) {
  return (
    getPokemon(build.pokemonId).mega ||
    pokemonAppearance(build.pokemonId, build.item).mega === true
  );
}

function uniquePartyItems(builds: ReturnType<typeof makeBuild>[]) {
  const used = new Set<string>();
  return builds.map((build) => {
    if (build.item === "もちものなし") return build;
    if (used.has(build.item)) return { ...build, item: "もちものなし" };
    used.add(build.item);
    return build;
  });
}

/** Build a full first-use party from ranked, locally supported candidates. */
export async function selectStarterParty(
  value: unknown,
  loadUsage: UsageLoader,
  isActive: () => boolean = () => true,
): Promise<StarterPartyResult | undefined> {
  if (!validIndex(value))
    return { ok: false, reason: "invalid-ranking", selected: 0 };

  const index = value as UsageIndex;
  const ranked = index.pokemon
    .flatMap((entry, order) =>
      hasValidRank(entry.rank) ? [{ ...entry, rank: entry.rank, order }] : [],
    )
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
  const seenIds = new Set<string>();
  const seenSources = new Set<number>();
  const builds: ReturnType<typeof makeBuild>[] = [];
  const picks: StarterPartyPick[] = [];
  const skippedMegas: SkippedStarterMega[] = [];
  let megaCount = 0;
  const snapshots = new Map<string, Promise<CacheEntry<UsageSnapshot>>>();

  for (const candidate of ranked) {
    if (!isActive()) return undefined;
    const id = normalizeId(candidate.id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const selected = pokemon.find((entry) => entry.speciesId === id);
    if (!selected) continue;
    const sourceId = sourcePokemonId(selected.id);
    if (seenSources.has(sourceId)) continue;
    seenSources.add(sourceId);

    if (selected.mega && megaCount >= 2) {
      skippedMegas.push({
        id: selected.id,
        name: selected.name,
        rank: candidate.rank,
        item: "もちものなし",
        megaSource: "direct",
      });
      continue;
    }

    let build = makeBuild(selected.id);
    const source = usageSourcePokemon(selected.id);
    if (source?.speciesId) {
      let request = snapshots.get(source.speciesId);
      if (!request) {
        request = loadUsage(source.speciesId).catch(() => ({
          checkedAt: "",
          attemptDay: "",
        }));
        snapshots.set(source.speciesId, request);
      }
      const entry = await request;
      if (!isActive()) return undefined;
      if (entry.data) {
        build = popularBuild(
          selected.id,
          entry.data,
          {},
          undefined,
          index,
        ).build;
      }
    }

    const mega = isMegaBuild(build);
    if (mega && megaCount >= 2) {
      skippedMegas.push({
        id: selected.id,
        name: selected.name,
        rank: candidate.rank,
        item: build.item,
        megaSource: "stone",
      });
      continue;
    }

    if (mega) megaCount++;
    builds.push(build);
    picks.push({
      id: selected.id,
      name: selected.name,
      rank: candidate.rank,
      item: build.item,
      mega,
      megaSource: selected.mega ? "direct" : mega ? "stone" : null,
    });
    if (builds.length === 6) break;
  }

  if (builds.length !== 6)
    return {
      ok: false,
      reason: "insufficient-ranked-pokemon",
      selected: builds.length,
    };

  const uniqueBuilds = uniquePartyItems(builds);
  const finalPicks = picks.map((pick, index) => ({
    ...pick,
    item: uniqueBuilds[index].item,
    mega: isMegaBuild(uniqueBuilds[index]),
  }));

  return {
    ok: true,
    party: { name: "スタンダード", members: uniqueBuilds },
    picks: finalPicks,
    skippedMegas,
  };
}

/** Fetch and resolve the ranking while discarding results canceled by user actions. */
export async function resolveStarterPartySelection(
  gate: DefaultBuildSelectionGate,
  ticket: DefaultBuildTicket,
  loadIndex: () => Promise<CacheEntry<UsageIndex>>,
  loadUsage: UsageLoader,
): Promise<StarterPartyResult | undefined> {
  let entry: CacheEntry<UsageIndex> | undefined;
  try {
    entry = await loadIndex();
  } catch {
    entry = undefined;
  }
  if (!gate.isCurrent(ticket)) return undefined;
  const result = await selectStarterParty(entry?.data, loadUsage, () =>
    gate.isCurrent(ticket),
  );
  if (!result) return undefined;
  if (!gate.complete(ticket)) return undefined;
  return result;
}

export function canApplyStarterParty(input: {
  firstUse: boolean;
  storageValue: string | null;
  userEdited: boolean;
  draft: Party;
  initial: Party;
}) {
  return (
    input.firstUse &&
    input.storageValue === null &&
    !input.userEdited &&
    !partyHasChanges(input.draft, input.initial)
  );
}
