import { useEffect, useMemo, useState } from 'react';
import { rollD20 } from './utils/dice';
import { clearState, loadState, saveState } from './utils/storage';
import { sortByInitiative } from './utils/sort';
import { AppState, Creature } from './types';

const defaultState: AppState = {
  dynamic: true,
  round: 0,
  inCombat: false,
  activeId: null,
  creatures: [],
};

const adjustBetween = (value: number) => Math.max(0, Math.min(3, value));

const getFirstActiveId = (creatures: Creature[]) =>
  creatures.find((c) => c.failures < 3)?.id ?? null;

const createId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const createOrder = (creatures: Creature[]) =>
  creatures.reduce((max, c) => Math.max(max, c.order), 0) + 1;

const updateInitiatives = (creatures: Creature[], dynamic: boolean) => {
  if (dynamic) {
    return creatures.map((creature) => {
      const roll = rollD20() + (creature.modifier ?? 0);
      if (creature.hp > 0) {
        return { ...creature, initiative: roll, frozen: false };
      }
      return {
        ...creature,
        initiative: creature.frozen && creature.initiative ? creature.initiative : roll,
        frozen: true,
      };
    });
  }

  return creatures.map((creature) => ({
    ...creature,
    initiative: creature.initiative ?? 0,
  }));
};

const getAvailable = (creatures: Creature[]) => creatures.filter((c) => c.failures < 3);

function App() {
  const [state, setState] = useState<AppState>(() => loadState() ?? defaultState);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    hp: '',
    me: '',
    otherName: '',
    otherValue: '',
    initiative: '',
    modifier: '',
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeIndexInfo = useMemo(() => {
    const available = getAvailable(state.creatures);
    const idx = available.findIndex((c) => c.id === state.activeId);
    return { available, idx };
  }, [state.activeId, state.creatures]);

  const handleAdd = () => {
    const name = form.name.trim();
    if (!name) return;
    const hp = Number(form.hp) || 0;
    const me = Number(form.me) || 0;
    const otherName = form.otherName.trim() || 'Ресурс';
    const otherValue = Number(form.otherValue) || 0;
    const initiative = Number(form.initiative) || 0;
    const modifier = Number(form.modifier) || 0;

    const newCreature: Creature = {
      id: createId(),
      order: createOrder(state.creatures),
      name,
      hp,
      me,
      otherName,
      otherValue,
      initiative: state.dynamic ? 0 : initiative,
      modifier: state.dynamic ? modifier : 0,
      frozen: false,
      successes: 0,
      failures: 0,
    };

    setState((prev) => ({
      ...prev,
      creatures: [...prev.creatures, newCreature],
      activeId: prev.activeId ?? newCreature.id,
    }));
    setShowForm(false);
    setForm({ name: '', hp: '', me: '', otherName: '', otherValue: '', initiative: '', modifier: '' });
  };

  const handleStart = () => {
    if (!state.creatures.length) return;
    const rolled = updateInitiatives(state.creatures, state.dynamic);
    const sorted = sortByInitiative(rolled);
    setState((prev) => ({
      ...prev,
      inCombat: true,
      creatures: sorted,
      activeId: getFirstActiveId(sorted),
    }));
  };

  const handleNewRound = () => {
    if (!state.inCombat) return;
    const nextRound = state.round + 1;
    const updated = state.dynamic ? updateInitiatives(state.creatures, true) : [...state.creatures];
    const ordered = state.dynamic ? sortByInitiative(updated) : updated;
    setState((prev) => ({
      ...prev,
      round: nextRound,
      creatures: ordered,
      activeId: getFirstActiveId(ordered),
    }));
  };

  const handleReset = () => {
    setState(defaultState);
    clearState();
  };

  const toggleDynamic = () => {
    setState((prev) => {
      const nextDynamic = !prev.dynamic;
      let creatures = [...prev.creatures];
      if (prev.inCombat && !nextDynamic) {
        creatures = sortByInitiative(
          creatures.map((c) => ({ ...c, initiative: c.initiative ?? 0 }))
        );
      }
      return { ...prev, dynamic: nextDynamic, creatures };
    });
  };

  const updateCreature = (id: string, updater: (c: Creature) => Creature) => {
    setState((prev) => ({
      ...prev,
      creatures: prev.creatures.map((c) => (c.id === id ? updater(c) : c)),
    }));
  };

  const adjustValue = (id: string, key: 'hp' | 'me' | 'otherValue', delta: number) => {
    updateCreature(id, (c) => ({ ...c, [key]: c[key] + delta } as Creature));
  };

  const setValue = (id: string, key: 'hp' | 'me' | 'otherValue', value: number) => {
    updateCreature(id, (c) => ({ ...c, [key]: value }));
  };

  const setDeathCount = (id: string, key: 'successes' | 'failures', value: number) => {
    updateCreature(id, (c) => ({ ...c, [key]: adjustBetween(value) }));
  };

  const handleNext = () => {
    const { available, idx } = activeIndexInfo;
    if (idx === -1) return;
    const next = available[idx + 1];
    if (next) {
      setState((prev) => ({ ...prev, activeId: next.id }));
    }
  };

  const handlePrev = () => {
    const { available, idx } = activeIndexInfo;
    if (idx <= 0) return;
    const prevItem = available[idx - 1];
    if (prevItem) {
      setState((prev) => ({ ...prev, activeId: prevItem.id }));
    }
  };

  const renderDeathRow = (creature: Creature) => (
    <div className="death-saves">
      <div className="death-row">
        <span>Успех</span>
        <div className="pips">
          {[0, 1, 2].map((i) => (
            <button
              key={`s-${i}`}
              className={i < creature.successes ? 'pip active' : 'pip'}
              onClick={() =>
                setDeathCount(
                  creature.id,
                  'successes',
                  i < creature.successes ? i : i + 1
                )
              }
              type="button"
            />
          ))}
        </div>
      </div>
      <div className="death-row">
        <span>Провал</span>
        <div className="pips">
          {[0, 1, 2].map((i) => (
            <button
              key={`f-${i}`}
              className={i < creature.failures ? 'pip active fail' : 'pip fail'}
              onClick={() =>
                setDeathCount(
                  creature.id,
                  'failures',
                  i < creature.failures ? i : i + 1
                )
              }
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );

  const isLastActive = activeIndexInfo.idx === activeIndexInfo.available.length - 1;
  const activeCreature = state.creatures.find((c) => c.id === state.activeId);

  return (
    <div className="app">
      <header className="top-bar">
        <div className="toggle" onClick={toggleDynamic} role="button" tabIndex={0}>
          <div className={`switch ${state.dynamic ? 'on' : 'off'}`}>
            <div className="knob" />
          </div>
          <span>Динамическая инициатива: {state.dynamic ? 'On' : 'Off'}</span>
        </div>
        <div className="round">Раунд: {state.round}</div>
        <button className="reset" onClick={handleReset} type="button">
          Сброс
        </button>
      </header>

      <div className="actions">
        {!state.inCombat && (
          <button className="add" onClick={() => setShowForm((p) => !p)} type="button">
            + Добавить
          </button>
        )}
        {!state.inCombat && state.creatures.length > 0 && (
          <button className="start" onClick={handleStart} type="button">
            Бой
          </button>
        )}
        {state.inCombat && (
          <button className="start" onClick={handleNewRound} type="button">
            Новый раунд
          </button>
        )}
      </div>

      {showForm && !state.inCombat && (
        <div className="card form">
          <div className="field">
            <label>Имя</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Обязательное"
            />
          </div>
          <div className="field triple">
            <div>
              <label>HP</label>
              <input
                value={form.hp}
                onChange={(e) => setForm((p) => ({ ...p, hp: e.target.value }))}
                inputMode="numeric"
              />
            </div>
            <div>
              <label>ME</label>
              <input
                value={form.me}
                onChange={(e) => setForm((p) => ({ ...p, me: e.target.value }))}
                inputMode="numeric"
              />
            </div>
            <div>
              <label>{form.otherName || 'Ресурс'}</label>
              <input
                value={form.otherValue}
                onChange={(e) => setForm((p) => ({ ...p, otherValue: e.target.value }))}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="field">
            <label>Название ресурса</label>
            <input
              value={form.otherName}
              onChange={(e) => setForm((p) => ({ ...p, otherName: e.target.value }))}
              placeholder="Например, выносливость"
            />
          </div>
          <div className="field">
            <label>{state.dynamic ? 'Модификатор инициативы' : 'Инициатива'}</label>
            <input
              value={state.dynamic ? form.modifier : form.initiative}
              onChange={(e) =>
                setForm((p) =>
                  state.dynamic
                    ? { ...p, modifier: e.target.value }
                    : { ...p, initiative: e.target.value }
                )
              }
              inputMode="numeric"
            />
          </div>
          <button className="start" onClick={handleAdd} type="button">
            Добавить
          </button>
        </div>
      )}

      <div className="list">
        {state.creatures.map((creature) => {
          const isActive = state.inCombat && creature.id === state.activeId;
          const eliminated = creature.failures >= 3;
          const collapsed = state.inCombat && !isActive;
          return (
            <div
              key={creature.id}
              className={`card ${isActive ? 'active' : ''} ${eliminated ? 'dead' : ''} ${collapsed ? 'collapsed' : ''}`}
            >
              <div className="card-header">
                <div>
                  <div className="name">{creature.name}</div>
                  <div className="initiative">
                    {state.dynamic ? 'иниц. мод: ' + creature.modifier : 'инициатива: ' + creature.initiative}
                    {state.inCombat && state.dynamic && ` | ролл: ${creature.initiative}`}
                  </div>
                </div>
                <div className="round-tag">#{creature.order}</div>
              </div>
              <div className="stats">
                <div className="stat">HP: {creature.hp}</div>
                <div className="stat">ME: {creature.me}</div>
                <div className="stat">
                  {creature.otherName}: {creature.otherValue}
                </div>
              </div>
              <div className="mini-death">{renderDeathRow(creature)}</div>

              {isActive && creature.hp <= 0 ? (
                <div className="main-block">
                  <div className="section-title">Death saves</div>
                  {renderDeathRow(creature)}
                </div>
              ) : (
                isActive && (
                  <div className="main-block">
                    <div className="section-title">Управление</div>
                    {(
                      [
                        { label: 'HP', key: 'hp' as const, value: creature.hp },
                        { label: 'ME', key: 'me' as const, value: creature.me },
                        {
                          label: creature.otherName,
                          key: 'otherValue' as const,
                          value: creature.otherValue,
                        },
                      ]
                    ).map((item) => (
                      <div className="control-row" key={item.key}>
                        <div className="control-label">{item.label}</div>
                        <div className="control-buttons">
                          {[-10, -5, -1, +1, +5, +10].map((step) => (
                            <button
                              type="button"
                              key={step}
                              onClick={() => adjustValue(creature.id, item.key, step)}
                            >
                              {step > 0 ? `+${step}` : step}
                            </button>
                          ))}
                        </div>
                        <input
                          className="inline-input"
                          type="number"
                          value={item.value}
                          onChange={(e) => setValue(creature.id, item.key, Number(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {state.inCombat && activeCreature && (
        <div className="nav">
          <button type="button" onClick={handlePrev} disabled={activeIndexInfo.idx <= 0}>
            ← Назад
          </button>
          {isLastActive ? (
            <button type="button" className="start" onClick={handleNewRound}>
              Новый раунд
            </button>
          ) : (
            <button type="button" onClick={handleNext}>
              Вперёд →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
