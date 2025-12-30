export type Creature = {
  id: string;
  order: number;
  name: string;
  hp: number;
  me: number;
  otherName: string;
  otherValue: number;
  initiative: number;
  modifier: number;
  frozen: boolean;
  successes: number;
  failures: number;
};

export type AppState = {
  dynamic: boolean;
  round: number;
  inCombat: boolean;
  activeId: string | null;
  creatures: Creature[];
};
