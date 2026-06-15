import type { Creature, Theme, TrackerState } from "./types";

export const STORAGE_KEY = "dnd-dynamic-initiative-tracker-v2";

export function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function createInitialState(): TrackerState {
  return {
    creatures: [],
    dynamicInitiative: true,
    round: 0,
    inCombat: false,
    activeId: null,
    theme: systemTheme(),
  };
}

export function loadState(): TrackerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();

    const saved = JSON.parse(raw) as Partial<TrackerState>;
    const initial = createInitialState();
    return {
      ...initial,
      ...saved,
      creatures: Array.isArray(saved.creatures) ? saved.creatures : [],
      theme: saved.theme === "dark" || saved.theme === "light" ? saved.theme : initial.theme,
    };
  } catch {
    return createInitialState();
  }
}

export function saveState(state: TrackerState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function stableSort(
  creatures: Creature[],
  initiative: (creature: Creature) => number,
): Creature[] {
  return [...creatures].sort(
    (a, b) => initiative(b) - initiative(a) || a.order - b.order,
  );
}

export function rollDynamicInitiative(
  creatures: Creature[],
  firstCombat: boolean,
): Creature[] {
  const rolled = creatures.map((creature) => {
    if (creature.hp > 0) {
      return {
        ...creature,
        currentInitiative: rollD20() + creature.initiativeModifier,
        initiativeFrozen: false,
      };
    }

    if (firstCombat && creature.currentInitiative === null) {
      return {
        ...creature,
        currentInitiative: rollD20() + creature.initiativeModifier,
        initiativeFrozen: true,
      };
    }

    return { ...creature, initiativeFrozen: true };
  });

  return stableSort(rolled, (creature) => creature.currentInitiative ?? 0);
}

export function sortFixedInitiative(creatures: Creature[]): Creature[] {
  return stableSort(creatures, (creature) => creature.fixedInitiative ?? 0);
}

export function firstEligibleId(creatures: Creature[]): string | null {
  return creatures.find((creature) => creature.failures < 3)?.id ?? null;
}

export function createId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
