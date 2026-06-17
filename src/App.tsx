import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Creature, CreatureDraft, CreatureStatus, TrackerState } from "./types";
import {
  STORAGE_KEY,
  clampDeathSaves,
  createId,
  createInitialState,
  firstEligibleId,
  getCreatureStatus,
  isTurnEligible,
  loadState,
  rollDynamicInitiative,
  saveState,
  sortFixedInitiative,
} from "./utils";

const STEPS = [-10, -5, -1, 1, 5, 10];
const HEAL_STEPS = [1, 5, 10];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 0 1 0 20.5 14.2Z" />
    </svg>
  );
}

function D20Icon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3 43 14v20L24 45 5 34V14L24 3Z" />
      <path d="m5 14 19 9 19-9M24 23v22M14 38l10-15 10 15M15 9l9 14L33 9" />
    </svg>
  );
}

function statusLabel(status: CreatureStatus): string {
  switch (status) {
    case "dead":
      return "Мёртв";
    case "stabilized":
      return "Стабилизирован";
    case "dying":
      return "При смерти";
    default:
      return "";
  }
}

function applyHpChange(creature: Creature, hp: number): Creature {
  if (hp > 0) {
    return {
      ...creature,
      hp,
      successes: 0,
      failures: 0,
      initiativeFrozen: false,
    };
  }

  if (hp === 0) {
    return {
      ...creature,
      hp,
      successes: 0,
      failures: 0,
      initiativeFrozen: true,
    };
  }

  const wasStabilized = getCreatureStatus(creature) === "stabilized";
  return {
    ...creature,
    hp,
    successes: wasStabilized ? 0 : creature.successes,
    failures: wasStabilized ? 0 : creature.failures,
    initiativeFrozen: true,
  };
}

interface DeathSavesProps {
  creature: Creature;
  compact?: boolean;
  onChange: (kind: "successes" | "failures", value: number) => void;
}

function DeathSaves({ creature, compact = false, onChange }: DeathSavesProps) {
  const row = (kind: "successes" | "failures", label: string) => {
    const count = creature[kind];
    return (
      <div className="save-row">
        <span>{label}</span>
        <div className="save-pips" aria-label={`${label}: ${count} из 3`}>
          {[1, 2, 3].map((value) => (
            <button
              className={`save-pip ${value <= count ? "filled" : ""} ${kind}`}
              key={value}
              type="button"
              aria-label={`${label} ${value}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange(kind, count === value ? value - 1 : value);
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`death-saves ${compact ? "compact" : ""}`} onClick={(event) => event.stopPropagation()}>
      {!compact && <div className="section-kicker">Спасброски от смерти</div>}
      {row("successes", "Успех")}
      {row("failures", "Провал")}
    </div>
  );
}

interface ResourceEditorProps {
  label: string;
  value: number;
  tone: "health" | "energy" | "other";
  onChange: (value: number) => void;
}

function ResourceEditor({ label, value, tone, onChange }: ResourceEditorProps) {
  return (
    <div className={`resource-editor ${tone}`}>
      <div className="resource-heading">
        <span>{label}</span>
        <input
          type="number"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </div>
      <div className="step-grid">
        {STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className={step < 0 ? "negative" : "positive"}
            onClick={() => onChange(value + step)}
          >
            {step > 0 ? `+${step}` : step}
          </button>
        ))}
      </div>
    </div>
  );
}

interface StabilizedPanelProps {
  creature: Creature;
  compact?: boolean;
  onHpChange: (value: number) => void;
}

function StabilizedPanel({ creature, compact = false, onHpChange }: StabilizedPanelProps) {
  return (
    <div className={`status-panel stabilized-panel ${compact ? "compact" : ""}`} onClick={(event) => event.stopPropagation()}>
      <div>
        <div className="section-kicker">Стабилизирован</div>
        <p>Не ходит в очереди, пока HP не станет выше 0.</p>
      </div>
      <div className="status-actions">
        <input
          className="quick-hp-input"
          type="number"
          value={creature.hp}
          aria-label={`HP ${creature.name}`}
          onChange={(event) => onHpChange(Number(event.target.value) || 0)}
        />
        <div className="heal-buttons">
          {HEAL_STEPS.map((step) => (
            <button type="button" key={step} onClick={() => onHpChange(creature.hp + step)}>
              +{step}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface RevivePanelProps {
  compact?: boolean;
  onRevive: () => void;
}

function RevivePanel({ compact = false, onRevive }: RevivePanelProps) {
  return (
    <div className={`status-panel revive-panel ${compact ? "compact" : ""}`} onClick={(event) => event.stopPropagation()}>
      <div>
        <div className="section-kicker">Мёртв</div>
        <p>Существо исключено из очереди хода.</p>
      </div>
      <button className="button revive-button" type="button" onClick={onRevive}>
        Воскресить
      </button>
    </div>
  );
}

interface AddCreatureFormProps {
  dynamic: boolean;
  onClose: () => void;
  onSubmit: (draft: CreatureDraft) => void;
}

function AddCreatureForm({ dynamic, onClose, onSubmit }: AddCreatureFormProps) {
  const [draft, setDraft] = useState<CreatureDraft>({
    name: "",
    hp: 10,
    me: 0,
    otherName: "Ресурс",
    otherValue: 0,
    initiativeModifier: 0,
    fixedInitiative: 0,
  });
  const [error, setError] = useState("");

  const setNumber = (field: keyof CreatureDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: Number(value) || 0 }));
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="add-form"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) {
            setError("Введите имя существа");
            return;
          }
          onSubmit({
            ...draft,
            name: draft.name.trim(),
            otherName: draft.otherName.trim() || "Ресурс",
          });
        }}
      >
        <div className="form-heading">
          <div>
            <div className="section-kicker">Новый участник</div>
            <h2>Добавить существо</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <label className="field full">
          <span>Имя</span>
          <input
            autoFocus
            value={draft.name}
            placeholder="Например, Варвар"
            onChange={(event) => {
              setError("");
              setDraft((current) => ({ ...current, name: event.target.value }));
            }}
          />
          {error && <small className="field-error">{error}</small>}
        </label>

        <div className="form-grid">
          <label className="field">
            <span>HP</span>
            <input type="number" value={draft.hp} onChange={(event) => setNumber("hp", event.target.value)} />
          </label>
          <label className="field">
            <span>ME</span>
            <input type="number" value={draft.me} onChange={(event) => setNumber("me", event.target.value)} />
          </label>
          <label className="field">
            <span>Другой ресурс</span>
            <input
              value={draft.otherName}
              onChange={(event) => setDraft((current) => ({ ...current, otherName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Значение</span>
            <input
              type="number"
              value={draft.otherValue}
              onChange={(event) => setNumber("otherValue", event.target.value)}
            />
          </label>
        </div>

        <label className="field full initiative-field">
          <span>{dynamic ? "Модификатор инициативы" : "Инициатива"}</span>
          <input
            type="number"
            value={dynamic ? draft.initiativeModifier : draft.fixedInitiative}
            onChange={(event) =>
              setNumber(dynamic ? "initiativeModifier" : "fixedInitiative", event.target.value)
            }
          />
        </label>

        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onClose}>Отмена</button>
          <button className="button primary" type="submit">Добавить</button>
        </div>
      </form>
    </div>
  );
}

function App() {
  const [state, setState] = useState<TrackerState>(loadState);
  const [showAddForm, setShowAddForm] = useState(false);
  const [roundAnimating, setRoundAnimating] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  useEffect(() => {
    saveState(state);
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      state.theme === "dark" ? "#15110f" : "#f4efe7",
    );
  }, [state]);

  useEffect(() => {
    if (!state.inCombat) return;
    const active = state.creatures.find((creature) => creature.id === state.activeId);
    if (!active || !isTurnEligible(active)) {
      const nextId = firstEligibleId(state.creatures);
      if (nextId !== state.activeId) {
        setState((current) => ({ ...current, activeId: nextId }));
      }
    }
  }, [state.activeId, state.creatures, state.inCombat]);

  const activeCreature = state.creatures.find((creature) => creature.id === state.activeId) ?? null;
  const eligibleIds = useMemo(
    () => state.creatures.filter(isTurnEligible).map((creature) => creature.id),
    [state.creatures],
  );
  const activeTurnIndex = activeCreature ? eligibleIds.indexOf(activeCreature.id) : -1;

  const updateCreature = (id: string, updater: (creature: Creature) => Creature) => {
    setState((current) => ({
      ...current,
      creatures: current.creatures.map((creature) =>
        creature.id === id ? updater(creature) : creature,
      ),
    }));
  };

  const setCreatureHp = (id: string, hp: number) => {
    setState((current) => {
      const creatures = current.creatures.map((creature) =>
        creature.id === id ? applyHpChange(creature, hp) : creature,
      );
      const activeStillEligible = creatures.some(
        (creature) => creature.id === current.activeId && isTurnEligible(creature),
      );
      const healedCreature = creatures.find((creature) => creature.id === id);
      return {
        ...current,
        creatures,
        activeId: activeStillEligible
          ? current.activeId
          : healedCreature && isTurnEligible(healedCreature)
            ? healedCreature.id
            : firstEligibleId(creatures),
      };
    });
  };

  const changeDeathSave = (
    id: string,
    kind: "successes" | "failures",
    value: number,
  ) => {
    setState((current) => {
      const creatures = current.creatures.map((creature) => {
        if (creature.id !== id) return creature;
        const nextValue = clampDeathSaves(value);
        const next = { ...creature, [kind]: nextValue };
        if (kind === "successes" && nextValue >= 3 && next.failures < 3) {
          return {
            ...next,
            hp: 0,
            initiativeFrozen: true,
          };
        }
        return next;
      });
      const activeStillEligible = creatures.some(
        (creature) => creature.id === current.activeId && isTurnEligible(creature),
      );
      return {
        ...current,
        creatures,
        activeId: activeStillEligible ? current.activeId : firstEligibleId(creatures),
      };
    });
  };

  const reviveCreature = (id: string) => {
    setState((current) => {
      const creatures = current.creatures.map((creature) =>
        creature.id === id
          ? {
              ...creature,
              hp: 1,
              successes: 0,
              failures: 0,
              initiativeFrozen: false,
            }
          : creature,
      );
      const activeStillEligible = creatures.some(
        (creature) => creature.id === current.activeId && isTurnEligible(creature),
      );
      return {
        ...current,
        creatures,
        activeId: activeStillEligible ? current.activeId : id,
      };
    });
  };

  const setInitiativeMode = (dynamicInitiative: boolean) => {
    setState((current) => {
      if (!current.inCombat || dynamicInitiative) {
        return { ...current, dynamicInitiative };
      }
      const creatures = sortFixedInitiative(current.creatures);
      return {
        ...current,
        dynamicInitiative,
        creatures,
        activeId: firstEligibleId(creatures),
      };
    });
  };

  const addCreature = (draft: CreatureDraft) => {
    setState((current) => ({
      ...current,
      creatures: [
        ...current.creatures,
        {
          ...draft,
          id: createId(),
          order: Math.max(-1, ...current.creatures.map((creature) => creature.order)) + 1,
          currentInitiative: null,
          initiativeFrozen: draft.hp <= 0,
          successes: 0,
          failures: 0,
        },
      ],
    }));
    setShowAddForm(false);
  };

  const startCombat = () => {
    setState((current) => {
      const creatures = current.dynamicInitiative
        ? rollDynamicInitiative(current.creatures, true)
        : sortFixedInitiative(current.creatures);
      return {
        ...current,
        creatures,
        inCombat: true,
        activeId: firstEligibleId(creatures),
      };
    });
  };

  const navigate = (direction: -1 | 1) => {
    const nextIndex = activeTurnIndex + direction;
    if (nextIndex >= 0 && nextIndex < eligibleIds.length) {
      setState((current) => ({ ...current, activeId: eligibleIds[nextIndex] }));
    }
  };

  const startNewRound = () => {
    setRoundAnimating(true);
    window.setTimeout(() => setRoundAnimating(false), 650);
    setState((current) => {
      const creatures = current.dynamicInitiative
        ? rollDynamicInitiative(current.creatures, false)
        : current.creatures;
      return {
        ...current,
        creatures,
        round: current.round + 1,
        activeId: firstEligibleId(creatures),
      };
    });
  };

  const changeInitiativeValue = (id: string, value: number) => {
    setState((current) => {
      const updated = current.creatures.map((creature) =>
        creature.id === id
          ? {
              ...creature,
              [current.dynamicInitiative ? "initiativeModifier" : "fixedInitiative"]: value,
            }
          : creature,
      );
      const creatures = current.inCombat && !current.dynamicInitiative
        ? sortFixedInitiative(updated)
        : updated;
      return { ...current, creatures };
    });
  };

  const reset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      window.setTimeout(() => setResetArmed(false), 2500);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    setState(createInitialState());
    setResetArmed(false);
    setShowAddForm(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="D&D Initiative Tracker">
          <D20Icon />
          <div>
            <span className="brand-name">INITIATIVE</span>
            <span className="brand-subtitle">D&D combat tracker</span>
          </div>
        </div>

        <div className="topbar-controls">
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Включить ${state.theme === "dark" ? "светлую" : "тёмную"} тему`}
            onClick={() => setState((current) => ({
              ...current,
              theme: current.theme === "dark" ? "light" : "dark",
            }))}
          >
            <span className={state.theme === "light" ? "active" : ""}><SunIcon /></span>
            <span className={state.theme === "dark" ? "active" : ""}><MoonIcon /></span>
          </button>
          <button className={`reset-button ${resetArmed ? "armed" : ""}`} type="button" onClick={reset}>
            {resetArmed ? "Точно?" : "Сброс"}
          </button>
        </div>
      </header>

      <main>
        <section className="combat-panel">
          <div className="mode-control">
            <div>
              <span className="control-label">Динамическая инициатива</span>
              <span className="control-description">
                {state.dynamicInitiative ? "Бросок d20 каждый раунд" : "Фиксированный порядок"}
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={state.dynamicInitiative}
                onChange={(event) => setInitiativeMode(event.target.checked)}
              />
              <span className="switch-track"><span className="switch-thumb" /></span>
              <span className="switch-value">{state.dynamicInitiative ? "ON" : "OFF"}</span>
            </label>
          </div>

          <div className={`round-display ${roundAnimating ? "animating" : ""}`}>
            <span>Раунд</span>
            <strong key={state.round}>{state.round}</strong>
          </div>
        </section>

        <section className="roster-section">
          <div className="roster-heading">
            <div>
              <div className="section-kicker">{state.inCombat ? "Очередь хода" : "Подготовка боя"}</div>
              <h1>{state.inCombat ? "Участники боя" : "Боевой отряд"}</h1>
            </div>
            {!state.inCombat && (
              <button className="button add-button" type="button" onClick={() => setShowAddForm(true)}>
                <span>+</span> Добавить
              </button>
            )}
          </div>

          {state.creatures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-die"><D20Icon /></div>
              <h2>Здесь пока тихо</h2>
              <p>Добавьте участников, укажите ресурсы и начните бой.</p>
              <button className="button primary" type="button" onClick={() => setShowAddForm(true)}>
                + Добавить первого
              </button>
            </div>
          ) : (
            <div className={`creature-list ${roundAnimating ? "round-shuffle" : ""}`}>
              {state.creatures.map((creature, index) => {
                const active = state.inCombat && creature.id === state.activeId;
                const status = getCreatureStatus(creature);
                const eliminated = status === "dead";
                const stabilized = status === "stabilized";
                const dying = status === "dying";
                const initiative = state.dynamicInitiative
                  ? state.inCombat ? creature.currentInitiative ?? 0 : creature.initiativeModifier
                  : creature.fixedInitiative;

                return (
                  <article
                    className={`creature-card ${active ? "active" : ""} ${eliminated ? "eliminated" : ""} ${status}`}
                    key={creature.id}
                    style={{ "--card-index": index } as CSSProperties}
                    onClick={() => {
                      if (state.inCombat && isTurnEligible(creature)) {
                        setState((current) => ({ ...current, activeId: creature.id }));
                      }
                    }}
                  >
                    <div className="card-accent" />
                    <div className="card-header">
                      <div className="turn-number">{String(index + 1).padStart(2, "0")}</div>
                      <div className="creature-identity">
                        <div className="name-row">
                          <h2>{creature.name}</h2>
                          {status !== "alive" && <span className={`status-badge ${status}`}>{statusLabel(status)}</span>}
                          {active && <span className="status-badge current">Ход</span>}
                        </div>
                        <div className="resource-summary">
                          <span className={creature.hp <= 0 ? "danger" : ""}>HP <b>{creature.hp}</b></span>
                          <span>ME <b>{creature.me}</b></span>
                          <span>{creature.otherName} <b>{creature.otherValue}</b></span>
                        </div>
                      </div>

                      <div className="initiative-box" onClick={(event) => event.stopPropagation()}>
                        <span>{state.dynamicInitiative && !state.inCombat ? "Мод." : "Иниц."}</span>
                        {state.dynamicInitiative && state.inCombat ? (
                          <strong>{initiative}</strong>
                        ) : (
                          <input
                            type="number"
                            value={initiative}
                            aria-label={`Инициатива ${creature.name}`}
                            onChange={(event) => changeInitiativeValue(creature.id, Number(event.target.value) || 0)}
                          />
                        )}
                        {state.dynamicInitiative && state.inCombat && (
                          <small>{creature.initiativeModifier >= 0 ? "+" : ""}{creature.initiativeModifier}</small>
                        )}
                        {creature.initiativeFrozen && <i title="Инициатива заморожена">◆</i>}
                      </div>

                      {!state.inCombat && (
                        <button
                          className="remove-button"
                          type="button"
                          aria-label={`Удалить ${creature.name}`}
                          onClick={() => setState((current) => ({
                            ...current,
                            creatures: current.creatures.filter((item) => item.id !== creature.id),
                          }))}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {state.inCombat && !active && dying && (
                      <DeathSaves
                        compact
                        creature={creature}
                        onChange={(kind, value) => changeDeathSave(creature.id, kind, value)}
                      />
                    )}
                    {state.inCombat && !active && stabilized && (
                      <StabilizedPanel
                        compact
                        creature={creature}
                        onHpChange={(value) => setCreatureHp(creature.id, value)}
                      />
                    )}
                    {state.inCombat && eliminated && (
                      <>
                        <DeathSaves
                          compact
                          creature={creature}
                          onChange={(kind, value) => changeDeathSave(creature.id, kind, value)}
                        />
                        <RevivePanel compact onRevive={() => reviveCreature(creature.id)} />
                      </>
                    )}

                    {active && (
                      <div className="active-content">
                        {dying && (
                          <DeathSaves
                            creature={creature}
                            onChange={(kind, value) => changeDeathSave(creature.id, kind, value)}
                          />
                        )}
                        {stabilized && (
                          <StabilizedPanel
                            creature={creature}
                            onHpChange={(value) => setCreatureHp(creature.id, value)}
                          />
                        )}
                        {eliminated && <RevivePanel onRevive={() => reviveCreature(creature.id)} />}
                        {status === "alive" && (
                          <div className="resource-grid">
                            <ResourceEditor
                              label="HP"
                              value={creature.hp}
                              tone="health"
                              onChange={(value) => setCreatureHp(creature.id, value)}
                            />
                            <ResourceEditor
                              label="ME"
                              value={creature.me}
                              tone="energy"
                              onChange={(value) => updateCreature(creature.id, (current) => ({ ...current, me: value }))}
                            />
                            <ResourceEditor
                              label={creature.otherName}
                              value={creature.otherValue}
                              tone="other"
                              onChange={(value) => updateCreature(creature.id, (current) => ({ ...current, otherValue: value }))}
                            />
                          </div>
                        )}

                        <div className="turn-navigation">
                          <button
                            className="nav-button"
                            type="button"
                            disabled={activeTurnIndex <= 0}
                            onClick={(event) => { event.stopPropagation(); navigate(-1); }}
                          >
                            <span>←</span> Назад
                          </button>
                          <div className="turn-progress">
                            <span>Ход</span>
                            <b>{activeTurnIndex + 1} / {eligibleIds.length}</b>
                          </div>
                          {activeTurnIndex === eligibleIds.length - 1 ? (
                            <button
                              className="button new-round-button"
                              type="button"
                              onClick={(event) => { event.stopPropagation(); startNewRound(); }}
                            >
                              <span className="spin-icon">↻</span> Новый раунд
                            </button>
                          ) : (
                            <button
                              className="nav-button forward"
                              type="button"
                              onClick={(event) => { event.stopPropagation(); navigate(1); }}
                            >
                              Далее <span>→</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {!state.inCombat && state.creatures.length > 0 && (
            <button className="button combat-button" type="button" onClick={startCombat}>
              <D20Icon />
              Начать бой
            </button>
          )}
        </section>
      </main>

      {showAddForm && (
        <AddCreatureForm
          dynamic={state.dynamicInitiative}
          onClose={() => setShowAddForm(false)}
          onSubmit={addCreature}
        />
      )}
    </div>
  );
}

export default App;
