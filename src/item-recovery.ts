export type RecoveryMode = "auto" | "none";
export type RecoveryInput = {
  maxHP: number;
  currentHP: number;
  hitRolls: number[][];
  item: string;
  defenderAbility: string;
  attackerAbility: string;
  attackerItem: string;
  move: string;
  mode: RecoveryMode;
  surviveFullHP: boolean;
};
type Outcome = {
  hp: number;
  healed: number;
  available: boolean;
  probability: number;
  blocked: boolean;
  sashAvailable: boolean;
};

export type RepeatedKOInput = RecoveryInput & {
  /** Whether Focus Sash can still activate. Sturdy is covered by surviveFullHP. */
  focusSash: boolean;
  /** Number of repeated move uses to consider. */
  useLimit?: number;
};

export type RepeatedKOResult = {
  firstKOUse: number | null;
  guaranteedKOUse: number | null;
  chanceByFirstKO: number | null;
  chanceByLimit: number;
  useLimit: number;
  impossible: boolean;
  alreadyKnockedOut: boolean;
};

type RecoveryRules = {
  berry: boolean;
  leftovers: boolean;
  enabled: boolean;
  berriesBlocked: boolean;
  removesItem: boolean;
  healBlock: boolean;
  maxHP: number;
  item: string;
  defenderAbility: string;
  input: RecoveryInput;
};

function recoveryRules(input: RecoveryInput): RecoveryRules {
  const { item, move, mode, defenderAbility, attackerAbility } = input;
  const berry = item === "Sitrus Berry" || item === "Oran Berry";
  const leftovers = item === "Leftovers";
  const ignoresAbility = ["Mold Breaker", "Teravolt", "Turboblaze"].includes(
    attackerAbility,
  );
  const sticky = defenderAbility === "Sticky Hold" && !ignoresAbility;
  const removesItem =
    !sticky &&
    (move === "Knock Off" ||
      (berry && ["Incinerate", "Bug Bite", "Pluck"].includes(move)) ||
      (!input.attackerItem && ["Thief", "Covet"].includes(move)));
  const healBlock =
    move === "Psychic Noise" &&
    attackerAbility !== "Sheer Force" &&
    item !== "Covert Cloak" &&
    (ignoresAbility ||
      !["Shield Dust", "Aroma Veil"].includes(defenderAbility));
  const berriesBlocked = [
    "Unnerve",
    "As One (Glastrier)",
    "As One (Spectrier)",
  ].includes(attackerAbility);
  return {
    berry,
    leftovers,
    enabled: mode === "auto" && defenderAbility !== "Klutz",
    berriesBlocked,
    removesItem,
    healBlock,
    maxHP: input.maxHP,
    item,
    defenderAbility,
    input,
  };
}

function initialOutcome(input: RecoveryInput, sashAvailable = false): Outcome {
  return {
    hp: input.currentHP,
    healed: 0,
    available: true,
    probability: 1,
    blocked: false,
    sashAvailable,
  };
}

function mergeOutcome(
  outcomes: Map<string, Outcome>,
  outcome: Outcome,
  trackHealing = true,
) {
  const key = `${outcome.hp}:${trackHealing ? outcome.healed : ""}:${outcome.available}:${outcome.blocked}:${outcome.sashAvailable}`;
  const previous = outcomes.get(key);
  if (previous) previous.probability += outcome.probability;
  else outcomes.set(key, outcome);
}

/** Apply one complete move use, keeping item consumption in each probability path. */
function applyHitRolls(
  states: Outcome[],
  input: RecoveryInput,
  rules: RecoveryRules,
  events: { removed: boolean; blocked: boolean },
  trackHealing = true,
): Outcome[] {
  for (const rolls of input.hitRolls) {
    const next = new Map<string, Outcome>();
    for (const state of states)
      for (const roll of rolls) {
        let {
          hp,
          healed,
          available,
          blocked: stateBlocked,
          sashAvailable,
        } = state;
        if (hp > 0) {
          const survivesWithSash =
            input.surviveFullHP &&
            hp === input.maxHP &&
            roll >= input.maxHP &&
            (!rules.item || rules.item !== "Focus Sash" || sashAvailable);
          const damage = survivesWithSash ? input.maxHP - 1 : roll;
          if (survivesWithSash && rules.item === "Focus Sash")
            sashAvailable = false;
          hp = Math.max(0, hp - damage);
          if (roll > 0 && rules.removesItem) {
            available = false;
            events.removed = true;
          }
          if (roll > 0 && rules.healBlock) {
            events.blocked = true;
            stateBlocked = true;
          }
          if (
            rules.enabled &&
            available &&
            rules.berry &&
            !rules.berriesBlocked &&
            !stateBlocked &&
            hp > 0 &&
            hp <= input.maxHP / 2
          ) {
            const base =
              rules.item === "Oran Berry" ? 10 : Math.floor(input.maxHP / 4);
            const amount =
              base * (rules.defenderAbility === "Ripen" ? 2 : 1) +
              (rules.defenderAbility === "Cheek Pouch"
                ? Math.floor(input.maxHP / 3)
                : 0);
            const restored = Math.min(input.maxHP - hp, amount);
            hp += restored;
            healed += restored;
            available = false;
          }
        }
        mergeOutcome(
          next,
          {
            hp,
            healed,
            available,
            probability: state.probability / rolls.length,
            blocked: stateBlocked,
            sashAvailable,
          },
          trackHealing,
        );
      }
    states = [...next.values()];
  }
  return states;
}

/** Apply leftovers and clear temporary per-use healing prevention. */
function finishAttack(
  states: Outcome[],
  rules: RecoveryRules,
  trackHealing = true,
): Outcome[] {
  const next = new Map<string, Outcome>();
  for (const state of states) {
    let { hp, healed, available } = state;
    if (
      rules.enabled &&
      rules.leftovers &&
      available &&
      hp > 0 &&
      !state.blocked
    ) {
      const restored = Math.min(
        rules.maxHP - hp,
        Math.max(1, Math.floor(rules.maxHP / 16)),
      );
      hp += restored;
      healed += restored;
    }
    mergeOutcome(
      next,
      {
        ...state,
        hp,
        healed,
        blocked: false,
      },
      trackHealing,
    );
  }
  return [...next.values()];
}

/** Defender HP after each hit, then one end-of-turn item activation. */
export function itemRecovery(input: RecoveryInput) {
  const { item, mode, defenderAbility } = input;
  const rules = recoveryRules(input);
  const { berry, leftovers, enabled, berriesBlocked } = rules;
  const notes: string[] = [];
  if (mode === "none")
    notes.push(
      "回復なし：アイテムによるHP回復のみ除外しています。持ち物によるダメージ補正は維持します。",
    );
  else if (defenderAbility === "Klutz" && (berry || leftovers))
    notes.push("ぶきようにより回復アイテムは発動しません。");
  else if (berriesBlocked && berry)
    notes.push("きんちょうかんにより、きのみは発動しません。");
  else if (item === "Shell Bell")
    notes.push(
      "かいがらのすずは持ち主が与えたダメージで回復するため、今回の被ダメージでは回復しません。",
    );
  else if (leftovers)
    notes.push(
      "たべのこし：生存時にターン終了時の1回分（最大HPの1/16）を反映。",
    );
  else if (berry)
    notes.push(
      `${item === "Sitrus Berry" ? "オボンのみ：HPが半分以下で最大HPの1/4" : "オレンのみ：HPが半分以下で10"}を回復。連続技は各ヒット後に判定し、消費は1回です。`,
    );
  if (enabled && berry && defenderAbility === "Ripen")
    notes.push("じゅくせい：きのみの回復量を2倍にします。");
  if (enabled && berry && defenderAbility === "Cheek Pouch")
    notes.push("ほおぶくろ：きのみ消費時に最大HPの1/3も回復します。");

  let states: Outcome[] = [
    initialOutcome(input, input.surviveFullHP && item === "Focus Sash"),
  ];
  const events = { removed: false, blocked: false };
  states = applyHitRolls(states, input, rules, events);
  states = finishAttack(states, rules);
  const { removed, blocked } = events;
  if (enabled && (berry || leftovers) && removed)
    notes.push(
      "選択した技で回復アイテムを除去するため、その後の回復はありません。",
    );
  if (enabled && (berry || leftovers) && blocked)
    notes.push("サイコノイズの回復封じを反映しています。");
  const healed = states.map((s) => s.healed),
    hp = states.map((s) => s.hp);
  if (
    enabled &&
    berry &&
    !berriesBlocked &&
    !removed &&
    !blocked &&
    Math.max(...healed) === 0
  )
    notes.push(
      "今回は、ひんしになるかHPが発動条件まで減らないため、きのみによる回復は0です。",
    );
  return {
    minHP: Math.min(...hp),
    maxHP: Math.max(...hp),
    minHealed: Math.min(...healed),
    maxHealed: Math.max(...healed),
    koChance:
      states.reduce((sum, s) => sum + (s.hp === 0 ? s.probability : 0), 0) *
      100,
    notes,
  };
}

/**
 * Estimate how many identical move uses KO the target. Each use draws fresh
 * damage rolls while berry consumption persists between uses. Leftovers heal
 * once at the end of every surviving use. Other battle state is held constant.
 */
export function repeatedAttackKnockout(
  input: RepeatedKOInput,
): RepeatedKOResult {
  const useLimit = Math.max(1, Math.floor(input.useLimit ?? 10));
  if (input.currentHP <= 0)
    return {
      firstKOUse: 0,
      guaranteedKOUse: 0,
      chanceByFirstKO: 100,
      chanceByLimit: 100,
      useLimit,
      impossible: false,
      alreadyKnockedOut: true,
    };
  if (input.hitRolls.flat().every((roll) => roll <= 0))
    return {
      firstKOUse: null,
      guaranteedKOUse: null,
      chanceByFirstKO: null,
      chanceByLimit: 0,
      useLimit,
      impossible: true,
      alreadyKnockedOut: false,
    };

  const rules = recoveryRules(input);
  let states: Outcome[] = [initialOutcome(input, input.focusSash)];
  let firstKOUse: number | null = null;
  let guaranteedKOUse: number | null = null;
  let chanceByFirstKO: number | null = null;
  let chanceByLimit = 0;
  let cumulativeKO = 0;
  let impossible = false;
  const seenStates = new Set<string>();
  const stateKey = (state: Outcome) =>
    `${state.hp}:${state.available}:${state.blocked}:${state.sashAvailable}`;

  for (let use = 1; use <= useLimit && states.length; use++) {
    for (const state of states) seenStates.add(stateKey(state));
    const events = { removed: false, blocked: false };
    states = applyHitRolls(states, input, rules, events, false);
    states = finishAttack(states, rules, false);
    const nextAlive: Outcome[] = [];
    let knockedOutThisUse = 0;
    for (const state of states) {
      if (state.hp === 0) knockedOutThisUse += state.probability;
      else nextAlive.push(state);
    }
    cumulativeKO = Math.min(1, cumulativeKO + knockedOutThisUse);
    if (firstKOUse === null && cumulativeKO > 0) {
      firstKOUse = use;
      chanceByFirstKO = cumulativeKO * 100;
    }
    if (nextAlive.length === 0) {
      guaranteedKOUse = use;
      chanceByLimit = 100;
      break;
    }
    states = nextAlive;
    chanceByLimit = cumulativeKO * 100;

    // Once the live state set is closed, repeating cannot make a new outcome
    // reachable. This avoids wasting work on stable recovery loops.
    if (
      states.length > 0 &&
      states.every((state) => seenStates.has(stateKey(state)))
    ) {
      if (firstKOUse === null && !knockedOutThisUse) impossible = true;
      if (impossible) break;
    }
  }

  return {
    firstKOUse,
    guaranteedKOUse,
    chanceByFirstKO,
    chanceByLimit,
    useLimit,
    impossible,
    alreadyKnockedOut: false,
  };
}
