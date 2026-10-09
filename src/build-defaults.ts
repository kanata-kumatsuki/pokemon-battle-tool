import {
  englishNatures,
  getPokemon,
  itemsForPokemon,
  japaneseAbility,
  japaneseItem,
  learnableMoves,
  makeBuild,
  moveByName,
  natures,
  supportedSeason,
  usageSourcePokemon,
  type Build,
} from "./data.ts";
import {
  loadUsageIndex,
  usageCompatible,
  validSnapshot,
  type CacheEntry,
  type UsageIndex,
  type UsageRow,
  type UsageSnapshot,
} from "./usage.ts";

export type DefaultBuildKnown = {
  ability?: boolean;
  item?: boolean;
  nature?: boolean;
  points?: boolean;
};

export type DefaultBuildOrder = "rate" | "rank" | "mixed" | "none";

export type PopularBuildResult = {
  build: Build;
  source: "usage" | "usual";
  reason?:
    | "missing"
    | "species"
    | "season"
    | "invalid"
    | "no-legal-rows"
    | "unsupported-form";
  applied: {
    ability: boolean;
    item: boolean;
    nature: boolean;
    points: boolean;
    moves: number;
  };
  order: DefaultBuildOrder;
  date?: string;
  season?: string;
  usageSourceName?: string;
};

function validPoints(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    value.every((n) => Number.isInteger(n) && n >= 0 && n <= 32) &&
    value.reduce((sum, n) => sum + n, 0) <= 66
  );
}

function comparable(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

function rowsInOrder(rows: UsageRow[], category: string) {
  const categoryRows = rows.filter(
    (row) =>
      row.category === category &&
      Number.isInteger(row.rank) &&
      row.rank > 0 &&
      (row.percent === null ||
        (Number.isFinite(row.percent) &&
          row.percent >= 0 &&
          row.percent <= 100)),
  );
  const order: DefaultBuildOrder =
    categoryRows.length > 0 && categoryRows.every((row) => row.percent !== null)
      ? "rate"
      : categoryRows.length > 0
        ? "rank"
        : "none";
  const ordered = [...categoryRows].sort(
    (a, b) =>
      (order === "rate" ? b.percent! - a.percent! : 0) ||
      a.rank - b.rank ||
      a.name.localeCompare(b.name),
  );
  return { rows: ordered, order };
}

function bestLegal<T>(
  rows: UsageRow[],
  category: string,
  convert: (name: string) => T | undefined,
  allowed: readonly T[],
) {
  for (const row of rowsInOrder(rows, category).rows) {
    const value = convert(row.name);
    if (value !== undefined && allowed.includes(value)) return value;
  }
  return undefined;
}

function toNature(name: string) {
  const value = comparable(name);
  return Object.entries(englishNatures).find(
    ([ja, en]) => comparable(ja) === value || comparable(en) === value,
  )?.[0];
}

function commonOrder(rows: UsageRow[]) {
  const orders = new Set(
    ["ability", "held_item", "stat_alignment", "stat_points", "move"]
      .map((category) => rowsInOrder(rows, category).order)
      .filter((order) => order !== "none"),
  );
  if (orders.size > 1) return "mixed";
  return (orders.values().next().value ?? "none") as DefaultBuildOrder;
}

/**
 * Build an initial set from independent category frequencies. It never infers
 * that those independently popular values were used together in one real set.
 */
export function popularBuild(
  pokemonId: number,
  usage?: UsageSnapshot,
  known: DefaultBuildKnown = {},
  knownBuild?: Build,
): PopularBuildResult {
  const initial = makeBuild(pokemonId);
  const pokemon = getPokemon(pokemonId);
  const usagePokemon = usageSourcePokemon(pokemonId);
  const usageSourceName =
    usagePokemon && usagePokemon.id !== pokemon.id
      ? usagePokemon.name
      : undefined;
  if (knownBuild?.pokemonId === pokemonId) {
    if (known.ability) initial.ability = knownBuild.ability;
    if (known.item) initial.item = knownBuild.item;
    if (known.nature) initial.nature = knownBuild.nature;
    if (known.points) initial.points = [...knownBuild.points];
  }
  const empty = {
    build: initial,
    source: "usual" as const,
    applied: {
      ability: false,
      item: false,
      nature: false,
      points: false,
      moves: 0,
    },
    order: "none" as const,
  };

  if (!usagePokemon?.speciesId) return { ...empty, reason: "unsupported-form" };
  if (!usage) return { ...empty, reason: "missing", usageSourceName };
  if (usage.speciesId !== usagePokemon.speciesId)
    return {
      ...empty,
      reason: "species",
      season: usage.season,
      date: usage.date,
      usageSourceName,
    };
  if (!usageCompatible(usage) || usage.season !== supportedSeason)
    return {
      ...empty,
      reason: "season",
      season: usage.season,
      date: usage.date,
      usageSourceName,
    };
  if (!validSnapshot(usage, usagePokemon.speciesId))
    return {
      ...empty,
      reason: "invalid",
      season: usage.season,
      date: usage.date,
      usageSourceName,
    };

  const rows = usage.rows;
  const moves = learnableMoves(pokemon).map(([name]) => name);
  const next = { ...initial };
  const applied = { ...empty.applied };

  if (!known.ability) {
    const ability = bestLegal(
      rows,
      "ability",
      japaneseAbility,
      pokemon.abilities,
    );
    if (ability) {
      next.ability = ability;
      applied.ability = true;
    }
  }
  if (!known.item) {
    const item = bestLegal(
      rows,
      "held_item",
      japaneseItem,
      itemsForPokemon(pokemon),
    );
    if (item) {
      next.item = item;
      applied.item = true;
    }
  }
  if (!known.nature) {
    const nature = bestLegal(rows, "stat_alignment", toNature, natures);
    if (nature) {
      next.nature = nature;
      applied.nature = true;
    }
  }
  if (!known.points) {
    const points = rowsInOrder(rows, "stat_points").rows.find((row) =>
      validPoints(row.points),
    )?.points;
    if (points) {
      next.points = [...points];
      applied.points = true;
    }
  }

  const seen = new Set<string>();
  const popularMoves: string[] = [];
  for (const row of rowsInOrder(rows, "move").rows) {
    const move = moveByName(row.name)?.name;
    const legal = moves.find(
      (name) => comparable(name) === comparable(move ?? ""),
    );
    if (legal && !seen.has(comparable(legal))) {
      popularMoves.push(legal);
      seen.add(comparable(legal));
    }
    if (popularMoves.length === 4) break;
  }
  if (popularMoves.length) {
    next.moves = popularMoves;
    applied.moves = popularMoves.length;
  }

  const anyApplied =
    applied.ability ||
    applied.item ||
    applied.nature ||
    applied.points ||
    applied.moves > 0;
  return {
    build: next,
    source: anyApplied ? "usage" : "usual",
    reason: anyApplied ? undefined : "no-legal-rows",
    applied,
    order: commonOrder(rows),
    date: usage.date,
    season: usage.season,
    usageSourceName,
  };
}

export type DefaultBuildTicket = Readonly<{
  id: number;
  revision: number;
  target: string;
}>;

/**
 * Allows only the most recent pending selection to apply after asynchronous
 * usage loading. Closing/canceling the picker advances the revision.
 */
export class DefaultBuildSelectionGate {
  private sequence = 0;
  private revision = 0;
  private current?: DefaultBuildTicket;

  begin(target: string): DefaultBuildTicket {
    const ticket = Object.freeze({
      id: ++this.sequence,
      revision: this.revision,
      target,
    });
    this.current = ticket;
    return ticket;
  }

  isCurrent(ticket: DefaultBuildTicket, target = ticket.target) {
    return (
      this.current?.id === ticket.id &&
      this.current.revision === ticket.revision &&
      ticket.revision === this.revision &&
      target === ticket.target
    );
  }

  complete(ticket: DefaultBuildTicket, target = ticket.target) {
    if (!this.isCurrent(ticket, target)) return false;
    this.current = undefined;
    return true;
  }

  cancel(target?: string) {
    if (target !== undefined && this.current?.target !== target) return false;
    if (!this.current) return false;
    this.revision++;
    this.current = undefined;
    return true;
  }
}

export function popularBuildFromEntry(
  pokemonId: number,
  entry: CacheEntry<UsageSnapshot> | undefined,
  known?: DefaultBuildKnown,
  knownBuild?: Build,
) {
  return {
    ...popularBuild(pokemonId, entry?.data, known, knownBuild),
    cacheError: entry?.error,
    checkedAt: entry?.checkedAt,
  };
}

export async function resolvePopularBuildSelection(
  gate: DefaultBuildSelectionGate,
  ticket: DefaultBuildTicket,
  pokemonId: number,
  load: (speciesId: string) => Promise<CacheEntry<UsageSnapshot>>,
  options: {
    known?: DefaultBuildKnown;
    knownBuild?: Build;
    target?: string;
    loadIndex?: () => Promise<CacheEntry<UsageIndex>>;
  } = {},
) {
  let entry: CacheEntry<UsageSnapshot> | undefined;
  let indexEntry: CacheEntry<UsageIndex> | undefined;
  let requestError: string | undefined;
  const speciesId = usageSourcePokemon(pokemonId)?.speciesId;
  if (speciesId) {
    await Promise.all([
      load(speciesId)
        .then((value) => {
          entry = value;
        })
        .catch((error: unknown) => {
          requestError ??=
            error instanceof Error ? error.message : "通信エラー";
        }),
      (options.loadIndex ?? loadUsageIndex)()
        .then((value) => {
          indexEntry = value;
        })
        .catch((error: unknown) => {
          requestError ??=
            error instanceof Error ? error.message : "一覧の通信エラー";
        }),
    ]);
  }
  if (!gate.complete(ticket, options.target ?? ticket.target)) return undefined;
  const unsupportedIndexSeason =
    indexEntry?.data && !usageCompatible(indexEntry.data);
  const result = unsupportedIndexSeason
    ? {
        ...popularBuild(
          pokemonId,
          undefined,
          options.known,
          options.knownBuild,
        ),
        reason: "season" as const,
        season: indexEntry!.data!.season,
        date: indexEntry!.data!.date,
      }
    : popularBuildFromEntry(
        pokemonId,
        entry,
        options.known,
        options.knownBuild,
      );
  return {
    ...result,
    cacheError: [entry?.error, indexEntry?.error].filter(Boolean).join(" "),
    indexDate: indexEntry?.data?.date,
    requestError,
  };
}
