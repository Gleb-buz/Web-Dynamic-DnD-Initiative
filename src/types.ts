export type Theme = "light" | "dark";

export interface Creature {
  id: string;
  order: number;
  name: string;
  hp: number;
  me: number;
  otherName: string;
  otherValue: number;
  initiativeModifier: number;
  fixedInitiative: number;
  currentInitiative: number | null;
  initiativeFrozen: boolean;
  successes: number;
  failures: number;
}

export interface TrackerState {
  creatures: Creature[];
  dynamicInitiative: boolean;
  round: number;
  inCombat: boolean;
  activeId: string | null;
  theme: Theme;
}

export type CreatureDraft = Pick<
  Creature,
  | "name"
  | "hp"
  | "me"
  | "otherName"
  | "otherValue"
  | "initiativeModifier"
  | "fixedInitiative"
>;
