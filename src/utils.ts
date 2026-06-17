import type { Creature, CreatureStatus, Theme, TrackerState } from "./types";

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
    const creatures = Array.isArray(saved.creatures)
      ? saved.creatures.map((creature) => ({
          ...creature,
          successes: clampDeathSaves(creature.successes),
          failures: clampDeathSaves(creature.failures),
          initiativeFrozen: Boolean(creature.initiativeFrozen),
        }))
      : [];

    return {
      ...initial,
      ...saved,
      creatures,
      activeId: typeof saved.activeId === "string" ? saved.activeId : null,
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

export function clampDeathSaves(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(3, value));
}

export function getCreatureStatus(creature: Creature): CreatureStatus {
  if (creature.failures >= 3) return "dead";
  if (creature.hp > 0) return "alive";
  if (creature.hp === 0 || creature.successes >= 3) return "stabilized";
  return "dying";
}

export function isTurnEligible(creature: Creature): boolean {
  const status = getCreatureStatus(creature);
  return status === "alive" || status === "dying";
}

export function firstEligibleId(creatures: Creature[]): string | null {
  return creatures.find(isTurnEligible)?.id ?? null;
}

export function createId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
