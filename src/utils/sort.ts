import { Creature } from '../types';

export const sortByInitiative = (creatures: Creature[]) =>
  [...creatures].sort((a, b) => {
    const initDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
    if (initDiff !== 0) return initDiff;
    return a.order - b.order;
  });
