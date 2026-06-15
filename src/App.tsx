import { useEffect, useMemo, useState } from "react";
import type { Creature, CreatureDraft, TrackerState } from "./types";
import {
  STORAGE_KEY,
  createId,
  createInitialState,
  firstEligibleId,
  loadState,
  rollDynamicInitiative,
  saveState,
  sortFixedInitiative,
} from "./utils";

const STEPS = [-10, -5, -1, 1, 5, 10];

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
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
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
        <div className="save-pips" aria-label={`${label}: ${count} Ð¸Ð· 3`}>
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
    <div className={`death-saves ${compact ? "compact" : ""}`}>
      {!compact && <div className="section-kicker">Ð¡Ð¿Ð°ÑÐ±Ñ€Ð¾ÑÐºÐ¸ Ð¾Ñ‚ ÑÐ¼ÐµÑ€Ñ‚Ð¸</div>}
      {row("successes", compact ? "Ð£" : "Ð£ÑÐ¿ÐµÑ…")}
      {row("failures", compact ? "ÐŸ" : "ÐŸÑ€Ð¾Ð²Ð°Ð»")}
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
    otherName: "Ð ÐµÑÑƒÑ€Ñ",
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
            setError("Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ Ð¸Ð¼Ñ ÑÑƒÑ‰ÐµÑÑ‚Ð²Ð°");
            return;
          }
          onSubmit({
            ...draft,
            name: draft.name.trim(),
            otherName: draft.otherName.trim() || "Ð ÐµÑÑƒÑ€Ñ",
          });
        }}
      >
        <div className="form-heading">
          <div>
            <div className="section-kicker">ÐÐ¾Ð²Ñ‹Ð¹ ÑƒÑ‡Ð°ÑÑ‚Ð½Ð¸Ðº</div>
            <h2>Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ ÑÑƒÑ‰ÐµÑÑ‚Ð²Ð¾</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ">
            Ã—
          </button>
        </div>

        <label className="field full">
          <span>Ð˜Ð¼Ñ</span>
          <input
            autoFocus
            value={draft.name}
            placeholder="ÐÐ°Ð¿Ñ€Ð¸Ð¼ÐµÑ€, Ð’Ð°Ñ€Ð²Ð°Ñ€"
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
            <span>Ð”Ñ€ÑƒÐ³Ð¾Ð¹ Ñ€ÐµÑÑƒÑ€Ñ</span>
            <input
              value={draft.otherName}
              onChange={(event) => setDraft((current) => ({ ...current, otherName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Ð—Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ</span>
            <input
              type="number"
              value={draft.otherValue}
              onChange={(event) => setNumber("otherValue", event.target.value)}
            />
          </label>
        </div>

        <label className="field full initiative-field">
          <span>{dynamic ? "ÐœÐ¾Ð´Ð¸Ñ„Ð¸ÐºÐ°Ñ‚Ð¾Ñ€ Ð¸Ð½Ð¸Ñ†Ð¸Ð°Ñ‚Ð¸Ð²Ñ‹" : "Ð˜Ð½Ð¸Ñ†Ð¸Ð°Ñ‚Ð¸Ð²Ð°"}</span>
          <input
            type="number"
            value={dynamic ? draft.initiativeModifier : draft.fixedInitiative}
            onChange={(event) =>
              setNumber(dynamic ? "initiativeModifier" : "fixedInitiative", event.target.value)
            }
          />
        </label>

        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onClose}>ÐžÑ‚Ð¼ÐµÐ½Ð°</button>
          <button className="button primary" type="submit">Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ</button>
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
    if (!active || active.failures >= 3) {
      const nextId = firstEligibleId(state.creatures);
      if (nextId !== state.activeId) {
        setState((current) => ({ ...current, activeId: nextId }));
      }
    }
  }, [state.activeId, state.creatures, state.inCombat]);

  const activeCreature = state.creatures.find((creature) => creature.id === state.activeId) ?? null;
  const eligibleIds = useMemo(
    () => state.creatures.filter((creature) => creature.failures < 3).map((creature) => creature.id),
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

  const changeDeathSave = (
    id: string,
    kind: "successes" | "failures",
    value: number,
  ) => {
    setState((current) => {
      const creatures = current.creatures.map((creature) =>
        creature.id === id ? { ...creature, [kind]: value } : creature,
      );
      const activeStillEligible = creatures.some(
        (creature) => creature.id === current.activeId && creature.failures < 3,
      );
      return {
        ...current,
        creatures,
        activeId: activeStillEligible ? current.activeId : firstEligibleId(creatures),
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
          initiativeFrozen: false,
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
            aria-label={`Ð’ÐºÐ»ÑŽÑ‡Ð¸Ñ‚ÑŒ ${state.theme === "dark" ? "ÑÐ²ÐµÑ‚Ð»ÑƒÑŽ" : "Ñ‚Ñ‘Ð¼Ð½ÑƒÑŽ"} Ñ‚ÐµÐ¼Ñƒ`}
            onClick={() => setState((current) => ({
              ...current,
              uóÝv¶‰žËkºwµçY
NÂˆ›Û\Ú^™NˆL\Âˆ›Û]ÙZYÚˆÂˆ]\‹\ÜXÚ[™ÎˆŒ[NÂŸB‚‹˜Ü™X]\™KZY[]HÂˆZ[‹]ÚYˆÂŸB‚‹›˜[YK\›ÝÈÂˆ\Ü^Nˆ›^Âˆ[YÛ‹Z][\ÎˆÙ[\ŽÂˆØ\ˆÂˆZ[‹]ÚYˆÂŸB‚‹›˜[YK\›ÝÈˆÂˆÝ™\™›ÝÎˆY[ŽÂˆX\™Ú[ŽˆÂˆ›ÛY˜[Z[Nˆ”ÜXÝ˜[‹Ù[Ü™ÚXKÙ\šYŽÂˆ›Û\Ú^™NˆŒÂˆ[™KZZYÚˆKŒNÂˆ^[Ý™\™›ÝÎˆ[\Ú\ÎÂˆÚ]K\ÜXÙNˆ›ÝÜ˜\ÂŸB‚‹œ™\ÛÝ\˜ÙK\Ý[[X\žHÂˆ\Ü^Nˆ›^Âˆ›^]Ü˜\ˆÜ˜\ÂˆØ\ˆÜM\ÂˆX\™Ú[‹]ÜˆÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™NˆL\Âˆ›Û]ÙZYÚˆŒÂŸB‚‹œ™\ÛÝ\˜ÙK\Ý[[X\žHˆÂˆX\™Ú[‹[YˆÜÂˆÛÛÜŽˆ˜\ŠK]^
NÂˆ›Û\Ú^™NˆLœÂŸB‚‹œ™\ÛÝ\˜ÙK\Ý[[X\žH™[™Ù\‹‹œ™\ÛÝ\˜ÙK\Ý[[X\žH™[™Ù\ˆˆÂˆÛÛÜŽˆ˜\ŠKY[™Ù\ŠNÂŸB‚‹œÝ]\ËX˜YÙHÂˆ›^ˆ]]ÎÂˆ›Ü™\‹\˜Y]\ÎˆNN\ÂˆY[™ÎˆÜÂˆ›Û\Ú^™NˆÂˆ›Û]ÙZYÚˆÂˆ]\‹\ÜXÚ[™ÎˆŒ[NÂˆ^]˜[œÙ›Ü›Nˆ\\˜Ø\ÙNÂŸB‚‹œÝ]\ËX˜YÙK˜Ý\œ™[ÂˆÛÛÜŽˆ˜\ŠKXœ˜[™]^
NÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKXœ˜[™\ÛÙ
NÂˆ[š[X][ÛŽˆ˜YÙK\[ÙHœÈX\ÙKZ[‹[Ý][™š[š]NÂŸB‚‹œÝ]\ËX˜YÙK™ÝÛˆÂˆÛÛÜŽˆÎMXŒMŽÂˆ˜XÚÙÜ›Ý[™ˆÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠKYÛÛ
HŒ	K˜[œÜ\™[
NÂŸB‚‹œÝ]\ËX˜YÙK™XYÂˆÛÛÜŽˆ˜\ŠKY[™Ù\ŠNÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKY[™Ù\‹\ÛÙ
NÂŸB‚‹š[š]X]]™KX›ÞÂˆÜÚ][ÛŽˆ™[]]™NÂˆ\Ü^NˆÜšYÂˆZ[‹]ÚYˆŒÂˆZ[‹ZZYÚˆMœÂˆXÙKXÛÛ[ˆÙ[\ŽÂˆ›Ü™\Žˆ\ÛÛY˜\ŠK[[™JNÂˆ›Ü™\‹\˜Y]\ÎˆLœÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKX™Ë\ÛÙ
NÂˆ^X[YÛŽˆÙ[\ŽÂŸB‚‹š[š]X]]™KX›ÞÜ[ˆÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™NˆÂˆ›Û]ÙZYÚˆÂˆ]\‹\ÜXÚ[™ÎˆŒY[NÂˆ^]˜[œÙ›Ü›Nˆ\\˜Ø\ÙNÂŸB‚‹š[š]X]]™KX›ÞÝ›Û™ÈÂˆ›ÛY˜[Z[Nˆ”ÜXÝ˜[‹Ù[Ü™ÚXKÙ\šYŽÂˆ›Û\Ú^™NˆŒÜÂˆ[™KZZYÚˆKŒNÂŸB‚‹š[š]X]]™KX›Þ[œ]ÂˆÚYˆMÂˆ›Ü™\ŽˆÂˆ˜XÚÙÜ›Ý[™ˆ˜[œÜ\™[ÂˆÛÛÜŽˆ˜\ŠK]^
NÂˆ›ÛY˜[Z[Nˆ”ÜXÝ˜[‹Ù[Ü™ÚXKÙ\šYŽÂˆ›Û\Ú^™NˆŒ\Âˆ›Û]ÙZYÚˆÌÂˆ^X[YÛŽˆÙ[\ŽÂŸB‚‹š[š]X]]™KX›Þ[œ]™›ØÝ\ÈÂˆÝ][™NˆÂŸB‚‹š[š]X]]™KX›ÞÛX[ÂˆÜÚ][ÛŽˆXœÛÛ]NÂˆšYÚˆM\Âˆ›ÝÛNˆM\ÂˆZ[‹]ÚYˆŒœÂˆ›Ü™\‹\˜Y]\ÎˆÜÂˆY[™ÎˆœÂˆÛÛÜŽˆ˜\ŠKXœ˜[™]^
NÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKXœ˜[™\ÛÙ
NÂˆ›Û\Ú^™NˆÂˆ›Û]ÙZYÚˆÂŸB‚‹š[š]X]]™KX›ÞHÂˆÜÚ][ÛŽˆXœÛÛ]NÂˆÜˆM\ÂˆšYÚˆMÂˆÛÛÜŽˆ˜\ŠKX›YJNÂˆ›Û\Ú^™Nˆ\Âˆ›Û\Ý[Nˆ›Ü›X[ÂŸB‚‹œ™[[Ý™KX]ÛˆÂˆ\Ü^NˆÜšYÂˆÚYˆÌÂˆZYÚˆÌÂˆXÙKZ][\ÎˆÙ[\ŽÂˆ›Ü™\‹\˜Y]\ÎˆÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™NˆŒÂˆ˜[œÚ][ÛŽˆÛÛÜˆM\ÈX\ÙK˜XÚÙÜ›Ý[™M\ÈX\ÙK˜[œÙ›Ü›HLŒ\ÈX\ÙNÂŸB‚‹œ™[[Ý™KX]ÛŽšÝ™\ˆÂˆÛÛÜŽˆ˜\ŠKY[™Ù\ŠNÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKY[™Ù\‹\ÛÙ
NÂˆ˜[œÙ›Ü›Nˆ›Ý]J™YÊNÂŸB‚‹˜XÝ]™KXÛÛ[ÂˆY[™ÎˆNNÂˆ[š[X][ÛŽˆÛÛ[\™]™X[ÌÌ\ÈX\ÙH›ÝÂŸB‚‹œ™\ÛÝ\˜ÙKYÜšYÂˆ\Ü^NˆÜšYÂˆÜšY][\]KXÛÛ[[œÎˆ™\X]
ËZ[›X^
YœŠJNÂˆØ\ˆLÂˆ›Ü™\‹]Üˆ\ÛÛY˜\ŠK[[™JNÂˆY[™Ë]ÜˆMœÂŸB‚‹œ™\ÛÝ\˜ÙKYY]ÜˆÂˆK\™\ÛÝ\˜ÙKXÛÛÜŽˆ˜\ŠKYÜ™Y[ŠNÂˆK\™\ÛÝ\˜ÙK\ÛÙˆ˜\ŠKYÜ™Y[‹\ÛÙ
NÂˆ›Ü™\Žˆ\ÛÛYÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠK\™\ÛÝ\˜ÙKXÛÛÜŠHŒ‰K˜\ŠK[[™JJNÂˆ›Ü™\‹\˜Y]\ÎˆLÜÂˆY[™ÎˆL\Âˆ˜XÚÙÜ›Ý[™ˆÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠK\™\ÛÝ\˜ÙK\ÛÙ
HÎ	K˜\ŠK\Ý\™˜XÙK\ÛÛY
JNÂŸB‚‹œ™\ÛÝ\˜ÙKYY]Ü‹™[™\™ÞHÂˆK\™\ÛÝ\˜ÙKXÛÛÜŽˆ˜\ŠKX›YJNÂˆK\™\ÛÝ\˜ÙK\ÛÙˆ˜\ŠKX›YK\ÛÙ
NÂŸB‚‹œ™\ÛÝ\˜ÙKYY]Ü‹›Ý\ˆÂˆK\™\ÛÝ\˜ÙKXÛÛÜŽˆ˜\ŠK]š[Û]
NÂˆK\™\ÛÝ\˜ÙK\ÛÙˆ˜\ŠK]š[Û]\ÛÙ
NÂŸB‚‹œ™\ÛÝ\˜ÙKZXY[™ÈÂˆ\Ü^Nˆ›^Âˆ[YÛ‹Z][\ÎˆÙ[\ŽÂˆ\ÝYžKXÛÛ[ˆÜXÙKX™]ÙY[ŽÂˆØ\ˆÂˆX\™Ú[‹X›ÝÛNˆLÂŸB‚‹œ™\ÛÝ\˜ÙKZXY[™ÈÜ[ˆÂˆÝ™\™›ÝÎˆY[ŽÂˆÛÛÜŽˆ˜\ŠK\™\ÛÝ\˜ÙKXÛÛÜŠNÂˆ›Û\Ú^™NˆLÂˆ›Û]ÙZYÚˆÂˆ]\‹\ÜXÚ[™ÎˆŒLY[NÂˆ^[Ý™\™›ÝÎˆ[\Ú\ÎÂˆ^]˜[œÙ›Ü›Nˆ\\˜Ø\ÙNÂˆÚ]K\ÜXÙNˆ›ÝÜ˜\ÂŸB‚‹œ™\ÛÝ\˜ÙKZXY[™È[œ]ÂˆÚYˆŽÂˆ›Ü™\Žˆ\ÛÛYÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠK\™\ÛÝ\˜ÙKXÛÛÜŠHÌ	K˜\ŠK[[™JJNÂˆ›Ü™\‹\˜Y]\ÎˆÂˆY[™Îˆ\ÜÂˆÛÛÜŽˆ˜\ŠK]^
NÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠK\Ý\™˜XÙK\ÛÛY
NÂˆ›Û\Ú^™NˆM\Âˆ›Û]ÙZYÚˆÂˆ^X[YÛŽˆšYÚÂŸB‚‹œÝ\YÜšYÂˆ\Ü^NˆÜšYÂˆÜšY][\]KXÛÛ[[œÎˆ™\X]
‹Z[›X^
YœŠJNÂˆØ\ˆÂŸB‚‹œÝ\YÜšY]ÛˆÂˆZ[‹]ÚYˆÂˆ›Ü™\Žˆ\ÛÛY˜\ŠK[[™JNÂˆ›Ü™\‹\˜Y]\ÎˆÜÂˆY[™ÎˆœœÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠK\Ý\™˜XÙK\ÛÛY
NÂˆ›Û\Ú^™Nˆ\Âˆ›Û]ÙZYÚˆÂˆ˜[œÚ][ÛŽˆ˜[œÙ›Ü›HL\ÈX\ÙKÛÛÜˆLŒ\ÈX\ÙK›Ü™\‹XÛÛÜˆLŒ\ÈX\ÙK˜XÚÙÜ›Ý[™LŒ\ÈX\ÙNÂŸB‚‹œÝ\YÜšY]ÛŽšÝ™\ˆÂˆ›Ü™\‹XÛÛÜŽˆ˜\ŠK\™\ÛÝ\˜ÙKXÛÛÜŠNÂˆÛÛÜŽˆ˜\ŠK\™\ÛÝ\˜ÙKXÛÛÜŠNÂˆ˜[œÙ›Ü›Nˆ˜[œÛ]VJLœ
NÂŸB‚‹œÝ\YÜšY]ÛŽ˜XÝ]™HÂˆ˜[œÙ›Ü›Nˆ˜[œÛ]VJ
HØØ[JŽ
NÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠK\™\ÛÝ\˜ÙK\ÛÙ
NÂŸB‚‹\›‹[˜]šYØ][ÛˆÂˆ\Ü^NˆÜšYÂˆÜšY][\]KXÛÛ[[œÎˆZ[›X^
LYœŠH]]ÈZ[›X^
LYœŠNÂˆØ\ˆLœÂˆ[YÛ‹Z][\ÎˆÙ[\ŽÂˆX\™Ú[‹]ÜˆMÜÂˆ›Ü™\‹]Üˆ\ÛÛY˜\ŠK[[™JNÂˆY[™Ë]ÜˆMœÂŸB‚‹›˜]‹X]ÛˆÂˆZ[‹ZZYÚˆœÂˆ›Ü™\Žˆ\ÛÛY˜\ŠK[[™JNÂˆ›Ü™\‹\˜Y]\ÎˆL\Âˆ˜XÚÙÜ›Ý[™ˆ˜\ŠK\Ý\™˜XÙK\ÛÛY
NÂˆ›Û\Ú^™NˆLœÂˆ›Û]ÙZYÚˆÂˆ˜[œÚ][ÛŽˆ˜[œÙ›Ü›HM\ÈX\ÙK›Ü™\‹XÛÛÜˆM\ÈX\ÙKÛÛÜˆM\ÈX\ÙK˜XÚÙÜ›Ý[™M\ÈX\ÙNÂŸB‚‹›˜]‹X]ÛŽšÝ™\Ž››Ý
™\ØX›Y
HÂˆ›Ü™\‹XÛÛÜŽˆ˜\ŠKXœ˜[™
NÂˆÛÛÜŽˆ˜\ŠKXœ˜[™
NÂˆ˜[œÙ›Ü›Nˆ˜[œÛ]V
Lœ
NÂŸB‚‹›˜]‹X]Û‹™›ÜØ\™šÝ™\Ž››Ý
™\ØX›Y
HÂˆ˜[œÙ›Ü›Nˆ˜[œÛ]V
œ
NÂŸB‚‹›˜]‹X]ÛŽ˜XÝ]™N››Ý
™\ØX›Y
HÂˆ˜[œÙ›Ü›NˆØØ[JŽMŠNÂŸB‚‹›˜]‹X]ÛŽ™\ØX›YÂˆÝ\œÛÜŽˆ›ÝX[ÝÙYÂˆÜXÚ]NˆŒÍNÂŸB‚‹›˜]‹X]ÛˆÜ[ˆÂˆX\™Ú[ŽˆÂˆ›Û\Ú^™NˆMœÂŸB‚‹\›‹\›ÙÜ™\ÜÈÂˆ\Ü^NˆÜšYÂˆZ[‹]ÚYˆŽÂˆ^X[YÛŽˆÙ[\ŽÂŸB‚‹\›‹\›ÙÜ™\ÜÈÜ[ˆÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™NˆÂˆ›Û]ÙZYÚˆÂˆ]\‹\ÜXÚ[™ÎˆŒLÙ[NÂˆ^]˜[œÙ›Ü›Nˆ\\˜Ø\ÙNÂŸB‚‹\›‹\›ÙÜ™\ÜÈˆÂˆ›Û\Ú^™NˆLœÂŸB‚‹›™]Ë\›Ý[™X]ÛˆÂˆ\ÝYžK\Ù[ŽˆÝ™]ÚÂˆÚ]K\ÜXÙNˆ›ÝÜ˜\ÂŸB‚‹›™]Ë\›Ý[™X]ÛŽšÝ™\ˆœÜ[‹ZXÛÛˆÂˆ[š[X][ÛŽˆXÛÛ‹\Ü[ˆL\ÈX\ÙNÂŸB‚‹™X]\Ø]™\ÈÂˆ\Ü^NˆÜšYÂˆØ\ˆLÜÂˆ›Ü™\‹]Üˆ\ÛÛY˜\ŠK[[™JNÂˆY[™ÎˆN\ÂŸB‚‹™X]\Ø]™\Ë˜ÛÛ\XÝÂˆÜšY][\]KXÛÛ[[œÎˆ™\X]
‹Z[›X^
YœŠJNÂˆØ\ˆMœÂˆX\™Ú[ŽˆMœLÜŽÂˆ›Ü™\‹]Üˆ\ÛÛY˜\ŠK[[™JNÂˆY[™ÎˆL\ÂŸB‚‹œØ]™K\›ÝÈÂˆ\Ü^Nˆ›^Âˆ[YÛ‹Z][\ÎˆÙ[\ŽÂˆ\ÝYžKXÛÛ[ˆÜXÙKX™]ÙY[ŽÂˆØ\ˆLœÂŸB‚‹œØ]™K\›ÝÈˆÜ[ˆÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™NˆL\Âˆ›Û]ÙZYÚˆÂˆ]\‹\ÜXÚ[™ÎˆŒ[NÂˆ^]˜[œÙ›Ü›Nˆ\\˜Ø\ÙNÂŸB‚‹œØ]™K\\ÈÂˆ\Ü^Nˆ›^ÂˆØ\ˆÂŸB‚‹œØ]™K\\ÂˆÚYˆ\ÂˆZYÚˆ\Âˆ›Ü™\ŽˆœÛÛY˜\ŠK[[™K\Ý›Û™ÊNÂˆ›Ü™\‹\˜Y]\ÎˆL	NÂˆ˜XÚÙÜ›Ý[™ˆ˜[œÜ\™[Âˆ˜[œÚ][ÛŽˆ˜[œÙ›Ü›HML\ÈÝXšXËX™^šY\ŠŒÍKM‹JK›Ü™\‹XÛÛÜˆML\ÈX\ÙK˜XÚÙÜ›Ý[™ML\ÈX\ÙK›Þ\ÚYÝÈML\ÈX\ÙNÂŸB‚‹œØ]™K\\šÝ™\ˆÂˆ˜[œÙ›Ü›NˆØØ[JKŒM
NÂŸB‚‹œØ]™K\\™š[YœÝXØÙ\ÜÙ\ÈÂˆ›Ü™\‹XÛÛÜŽˆ˜\ŠKYÜ™Y[ŠNÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKYÜ™Y[ŠNÂˆ›Þ\ÚYÝÎˆÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠKYÜ™Y[ŠHLÉK˜[œÜ\™[
NÂŸB‚‹œØ]™K\\™š[Y™˜Z[\™\ÈÂˆ›Ü™\‹XÛÛÜŽˆ˜\ŠKY[™Ù\ŠNÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKY[™Ù\ŠNÂˆ›Þ\ÚYÝÎˆÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠKY[™Ù\ŠHLÉK˜[œÜ\™[
NÂŸB‚‹˜Ü™X]\™KXØ\™™[[Z[˜]YÂˆÜXÚ]NˆNÂˆš[\ŽˆØ]\˜]JJNÂŸB‚‹˜Ü™X]\™KXØ\™™[[Z[˜]Y›˜[YK\›ÝÈ‹‹˜Ü™X]\™KXØ\™™[[Z[˜]Yœ™\ÛÝ\˜ÙK\Ý[[X\žHÂˆ^YXÛÜ˜][ÛŽˆ[™K]›ÝYÚÂŸB‚‹™[\K\Ý]HÂˆ\Ü^NˆÜšYÂˆZ[‹ZZYÚˆÌÌÂˆXÙKZ][\ÎˆÙ[\ŽÂˆ[YÛ‹XÛÛ[ˆÙ[\ŽÂˆ›Ü™\Žˆ\\ÚY˜\ŠK[[™K\Ý›Û™ÊNÂˆ›Ü™\‹\˜Y]\ÎˆŒœÂˆY[™ÎˆÎŒÂˆ˜XÚÙÜ›Ý[™ˆÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠK\Ý\™˜XÙJHN	K˜[œÜ\™[
NÂˆ^X[YÛŽˆÙ[\ŽÂŸB‚‹™[\KYYHÂˆ\Ü^NˆÜšYÂˆÚYˆÌœÂˆZYÚˆÌœÂˆX\™Ú[‹X›ÝÛNˆM\ÂˆXÙKZ][\ÎˆÙ[\ŽÂˆ›Ü™\‹\˜Y]\ÎˆÂˆÛÛÜŽˆ˜\ŠKXœ˜[™
NÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKXœ˜[™\ÛÙ
NÂˆ˜[œÙ›Ü›Nˆ›Ý]JMYYÊNÂŸB‚‹™[\KYYHÝ™ÈÂˆÚYˆÂˆZYÚˆÂˆš[ˆ›Û™NÂˆÝ›ÚÙNˆÝ\œ™[ÛÛÜŽÂˆÝ›ÚÙK]ÚYˆKŽÂŸB‚‹™[\K\Ý]HˆÂˆX\™Ú[‹X›ÝÛNˆœÂˆ›ÛY˜[Z[Nˆ”ÜXÝ˜[‹Ù[Ü™ÚXKÙ\šYŽÂˆ›Û\Ú^™Nˆ\ÂŸB‚‹™[\K\Ý]HÂˆX^]ÚYˆÍŒÂˆX\™Ú[‹X›ÝÛNˆŒÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™NˆLÜÂŸB‚‹˜ÛÛX˜]X]ÛˆÂˆÚYˆL	NÂˆZ[‹ZZYÚˆMœÂˆX\™Ú[‹]ÜˆNÂˆ›Ü™\ŽˆÂˆ›Ü™\‹\˜Y]\ÎˆM\Âˆ›Û\Ú^™NˆMÂˆ]\‹\ÜXÚ[™ÎˆŒÙ[NÂŸB‚‹˜ÛÛX˜]X]ÛˆÝ™ÈÂˆÚYˆ\ÂˆZYÚˆ\Âˆš[ˆ›Û™NÂˆÝ›ÚÙNˆÝ\œ™[ÛÛÜŽÂˆÝ›ÚÙK]ÚYˆKÎÂŸB‚‹›[Ù[X˜XÚÙ›ÜÂˆÜÚ][ÛŽˆš^YÂˆ‹Z[™^ˆLÂˆ[œÙ]ˆÂˆ\Ü^NˆÜšYÂˆXÙKZ][\ÎˆÙ[\ŽÂˆÝ™\™›ÝË^Nˆ]]ÎÂˆY[™ÎˆŒÂˆ˜XÚÙÜ›Ý[™ˆ™Ø˜JL‹KN
NÂˆ˜XÚÙ›ÜYš[\Žˆ›\Š
NÂˆ[š[X][ÛŽˆ˜YKZ[ˆN\ÈX\ÙH›ÝÂŸB‚‹˜YY›Ü›HÂˆÚYˆZ[ŠLŒL	JNÂˆ›Ü™\Žˆ\ÛÛY˜\ŠK[[™JNÂˆ›Ü™\‹\˜Y]\ÎˆŒœÂˆY[™ÎˆÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠK\Ý\™˜XÙK\ÛÛY
NÂˆ›Þ\ÚYÝÎˆÌL™Ø˜JŒÊNÂˆ[š[X][ÛŽˆ[Ù[Y[\ˆÌŒ\ÈÝXšXËX™^šY\ŠŒŒ‹KŒÍ‹JH›ÝÂŸB‚‹™›Ü›KZXY[™ÈÂˆ\Ü^Nˆ›^Âˆ[YÛ‹Z][\ÎˆÝ\Âˆ\ÝYžKXÛÛ[ˆÜXÙKX™]ÙY[ŽÂˆØ\ˆMœÂˆX\™Ú[‹X›ÝÛNˆŒÂŸB‚‹™›Ü›KZXY[™ÈˆÂˆX\™Ú[ŽˆÂˆ›ÛY˜[Z[Nˆ”ÜXÝ˜[‹Ù[Ü™ÚXKÙ\šYŽÂˆ›Û\Ú^™NˆÜÂŸB‚‹šXÛÛ‹X]ÛˆÂˆ\Ü^NˆÜšYÂˆÚYˆÍœÂˆZYÚˆÍœÂˆXÙKZ][\ÎˆÙ[\ŽÂˆ›Ü™\‹\˜Y]\ÎˆLÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™Nˆ\Âˆ˜[œÚ][ÛŽˆÛÛÜˆM\ÈX\ÙK˜XÚÙÜ›Ý[™M\ÈX\ÙK˜[œÙ›Ü›HM\ÈX\ÙNÂŸB‚‹šXÛÛ‹X]ÛŽšÝ™\ˆÂˆÛÛÜŽˆ˜\ŠKY[™Ù\ŠNÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKY[™Ù\‹\ÛÙ
NÂˆ˜[œÙ›Ü›Nˆ›Ý]JYYÊNÂŸB‚‹™›Ü›KYÜšYÂˆ\Ü^NˆÜšYÂˆÜšY][\]KXÛÛ[[œÎˆ™\X]
‹Z[›X^
YœŠJNÂˆØ\ˆLÜÂˆX\™Ú[‹]ÜˆLÜÂŸB‚‹™šY[Âˆ\Ü^NˆÜšYÂˆØ\ˆœÂŸB‚‹™šY[™[ÂˆÚYˆL	NÂŸB‚‹™šY[Ü[ˆÂˆÛÛÜŽˆ˜\ŠK]^[]]Y
NÂˆ›Û\Ú^™NˆLÂˆ›Û]ÙZYÚˆÂˆ]\‹\ÜXÚ[™ÎˆŒ[NÂˆ^]˜[œÙ›Ü›Nˆ\\˜Ø\ÙNÂŸB‚‹™šY[[œ]ÂˆÚYˆL	NÂˆZ[‹ZZYÚˆÂˆ›Ü™\Žˆ\ÛÛY˜\ŠK[[™K\Ý›Û™ÊNÂˆ›Ü™\‹\˜Y]\ÎˆLÂˆY[™Îˆ\L\ÂˆÛÛÜŽˆ˜\ŠK]^
NÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠKX™ÊNÂˆ˜[œÚ][ÛŽˆ›Ü™\‹XÛÛÜˆM\ÈX\ÙK›Þ\ÚYÝÈM\ÈX\ÙK˜XÚÙÜ›Ý[™M\ÈX\ÙNÂŸB‚‹™šY[[œ]™›ØÝ\ÈÂˆ›Ü™\‹XÛÛÜŽˆ˜\ŠKXœ˜[™
NÂˆÝ][™NˆÂˆ˜XÚÙÜ›Ý[™ˆ˜\ŠK\Ý\™˜XÙK\ÛÛY
NÂˆ›Þ\ÚYÝÎˆÜÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠKXœ˜[™
HL‰K˜[œÜ\™[
NÂŸB‚‹š[š]X]]™KYšY[ÂˆX\™Ú[‹]ÜˆLÜÂŸB‚‹™šY[Y\œ›ÜˆÂˆÛÛÜŽˆ˜\ŠKY[™Ù\ŠNÂˆ›Û\Ú^™NˆL\ÂŸB‚‹™›Ü›KXXÝ[ÛœÈÂˆ\Ü^NˆÜšYÂˆÜšY][\]KXÛÛ[[œÎˆYœˆKœŽÂˆØ\ˆLÂˆX\™Ú[‹]ÜˆŒÜÂŸB‚‹œ›Ý[™\ÚY™›H˜Ü™X]\™KXØ\™Âˆ[š[X][ÛŽˆ›Ý[™XØ\™\ÚY™›HŒŒ\È›ÝÂˆ[š[X][Û‹Y[^NˆØ[Ê˜\ŠKXØ\™Z[™^
H
ˆ[\ÊNÂŸB‚Ù^Yœ˜[Y\ÈØ\™Y[\ˆÂˆœ›ÛHÈÜXÚ]NˆÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJLœ
NÈBˆÈÈÜXÚ]NˆNÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJ
NÈBŸB‚Ù^Yœ˜[Y\ÈXÝ]™KXØ\™[Ü[ˆÂˆœ›ÛHÈ˜[œÙ›Ü›NˆØØ[JŽNJNÈBˆÈÈ˜[œÙ›Ü›NˆØØ[JJNÈBŸB‚Ù^Yœ˜[Y\ÈÛÛ[\™]™X[Âˆœ›ÛHÈÜXÚ]NˆÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJMÜ
NÈBˆÈÈÜXÚ]NˆNÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJ
NÈBŸB‚Ù^Yœ˜[Y\È˜YÙK\[ÙHÂˆL	HÈ›Þ\ÚYÝÎˆ\ÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠKXœ˜[™
HL	K˜[œÜ\™[
NÈBŸB‚Ù^Yœ˜[Y\È›Ý[™\[™[\[ÙHÂˆ	HÈ›Ü™\‹XÛÛÜŽˆ˜\ŠKXœ˜[™
NÈ›Þ\ÚYÝÎˆœÛÛÜ‹[Z^
[ˆÜ™Ø‹˜\ŠKXœ˜[™
HL	K˜[œÜ\™[
NÈBŸB‚Ù^Yœ˜[Y\È›Ý[™[[X™\‹\ÜÂˆ	HÈÜXÚ]NˆÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJLœ
HØØ[JŠNÈBˆŒ	HÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJLœ
HØØ[JKŒŒŠNÈBˆL	HÈÜXÚ]NˆNÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJ
HØØ[JJNÈBŸB‚Ù^Yœ˜[Y\È›Ý[™XØ\™\ÚY™›HÂˆ	HÈÜXÚ]NˆÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJLÜ
HØØ[JŽN
NÈBˆMIHÈÜXÚ]NˆNÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJLœ
HØØ[JKŒJNÈBˆL	HÈÜXÚ]NˆNÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJ
HØØ[JJNÈBŸB‚Ù^Yœ˜[Y\ÈXÛÛ‹\Ü[ˆÂˆÈÈ˜[œÙ›Ü›Nˆ›Ý]JÍŒYÊNÈBŸB‚Ù^Yœ˜[Y\È˜YKZ[ˆÂˆœ›ÛHÈÜXÚ]NˆÈBˆÈÈÜXÚ]NˆNÈBŸB‚Ù^Yœ˜[Y\È[Ù[Y[\ˆÂˆœ›ÛHÈÜXÚ]NˆÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJMœ
HØØ[JŽMÊNÈBˆÈÈÜXÚ]NˆNÈ˜[œÙ›Ü›Nˆ˜[œÛ]VJ
HØØ[JJNÈBŸB‚YYXH
X^]ÚYˆÌŒ
HÂˆXZ[ˆÂˆÚYˆZ[ŠL	HHŒœN
NÂˆY[™Ë]ÜˆNÂˆB‚ˆ˜ÛÛX˜]\[™[ÂˆX\™Ú[‹X›ÝÛNˆÌÂˆB‚ˆ›[ÙKXÛÛ›ÛÂˆY[™ÎˆMÂˆB‚ˆœ™\ÛÝ\˜ÙKYÜšYÂˆÜšY][\]KXÛÛ[[œÎˆYœŽÂˆB‚ˆœ™\ÛÝ\˜ÙKYY]ÜˆÂˆ\Ü^NˆÜšYÂˆÜšY][\]KXÛÛ[[œÎˆZ[›X^
LLÙœŠHYœŽÂˆ[YÛ‹Z][\ÎˆÙ[\ŽÂˆØ\ˆLÂˆB‚ˆœ™\ÛÝ\˜ÙKZXY[™ÈÂˆX\™Ú[‹X›ÝÛNˆÂˆBŸB‚YYXH
X^]ÚYˆ
HÂˆÜ˜\ˆÂˆZ[‹ZZYÚˆÂˆY[™Îˆ\L\ÂˆB‚ˆ˜œ˜[™ˆÝ™ÈÂˆÚYˆÌœÂˆZYÚˆÌœÂˆB‚ˆ˜œ˜[™[˜[YHÂˆ›Û\Ú^™NˆMÂˆB‚ˆ˜œ˜[™\ÝX]HÂˆ\Ü^Nˆ›Û™NÂˆB‚ˆÜ˜\‹XÛÛ›ÛÈÂˆØ\ˆÜÂˆB‚ˆ[YK]ÙÙÛHÜ[ˆÂˆÚYˆÜÂˆZYÚˆÜÂˆB‚ˆœ™\Ù]X]ÛˆÂˆZ[‹]ÚYˆNÂˆY[™ËZ[›[™NˆÜÂˆ›Û\Ú^™NˆL\ÂˆB‚ˆ˜ÛÛX˜]\[™[ÂˆÜšY][\]KXÛÛ[[œÎˆZ[›X^
YœŠHÍÜÂˆØ\ˆÂˆB‚ˆ›[ÙKXÛÛ›ÛÂˆØ\ˆÂˆB‚ˆ˜ÛÛ›Û[X™[Âˆ›Û\Ú^™NˆLœÂˆB‚ˆ˜ÛÛ›ÛY\ØÜš\[Û‹ˆœÝÚ]Ú]˜[YHÂˆ\Ü^Nˆ›Û™NÂˆB‚ˆœ›Ý[™Y\Ü^HÂˆZ[‹]ÚYˆÂˆB‚ˆœ›ÜÝ\‹ZXY[™ÈÂˆ[YÛ‹Z][\ÎˆÙ[\ŽÂˆB‚ˆœ›ÜÝ\‹ZXY[™ÈHÂˆ›Û\Ú^™NˆÜÂˆB‚ˆ˜YX]ÛˆÂˆZ[‹ZZYÚˆÎ\ÂˆY[™ÎˆL\Âˆ›Û\Ú^™NˆL\ÂˆB‚ˆ˜Ø\™ZXY\ˆÂˆÜšY][\]KXÛÛ[[œÎˆZ[›X^
YœŠHN]]ÎÂˆØ\ˆÂˆZ[‹ZZYÚˆÍœÂˆY[™ÎˆLœL\LœM\ÂˆB‚ˆ\›‹[[X™\ˆÂˆ\Ü^Nˆ›Û™NÂˆB‚ˆ›˜[YK\›ÝÈÂˆØ\ˆ\ÂˆB‚ˆ›˜[YK\›ÝÈˆÂˆ›Û\Ú^™NˆNÂˆB‚ˆœÝ]\ËX˜YÙHÂˆY[™ÎˆÜ\Âˆ›Û\Ú^™NˆÜÂˆB‚ˆœÝ]\ËX˜YÙK˜Ý\œ™[Âˆ\Ü^Nˆ›Û™NÂˆB‚ˆœ™\ÛÝ\˜ÙK\Ý[[X\žHÂˆØ\ˆ\\Âˆ›Û\Ú^™Nˆ\ÂˆB‚ˆœ™\ÛÝ\˜ÙK\Ý[[X\žHˆÂˆ›Û\Ú^™NˆLÂˆB‚ˆš[š]X]]™KX›ÞÂˆZ[‹]ÚYˆMœÂˆZ[‹ZZYÚˆLœÂˆB‚ˆœ™[[Ý™KX]ÛˆÂˆÚYˆ\ÂˆB‚ˆ˜XÝ]™KXÛÛ[ÂˆY[™ÎˆL\LœÂˆB‚ˆœ™\ÛÝ\˜ÙKYY]ÜˆÂˆÜšY][\]KXÛÛ[[œÎˆYœŽÂˆY[™Îˆ\ÂˆB‚ˆœ™\ÛÝ\˜ÙKZXY[™ÈÂˆ\Ü^NˆÜšYÂˆØ\ˆÂˆB‚ˆœ™\ÛÝ\˜ÙKZXY[™È[œ]ÂˆÚYˆL	NÂˆ^X[YÛŽˆYÂˆB‚ˆœÝ\YÜšYÂˆØ\ˆÜÂˆB‚ˆœÝ\YÜšY]ÛˆÂˆY[™ÎˆÜ\Âˆ›Û\Ú^™NˆÂˆB‚ˆ\›‹[˜]šYØ][ÛˆÂˆÜšY][\]KXÛÛ[[œÎˆYœˆ]]ÈYœŽÂˆØ\ˆÜÂˆB‚ˆ›˜]‹X]Û‹ˆ›™]Ë\›Ý[™X]ÛˆÂˆZ[‹]ÚYˆÂˆY[™ËZ[›[™NˆÂˆ›Û\Ú^™NˆLÂˆB‚ˆ\›‹\›ÙÜ™\ÜÈÂˆZ[‹]ÚYˆÂˆB‚ˆ™X]\Ø]™\Ë˜ÛÛ\XÝÂˆX\™Ú[‹[YˆM\ÂˆB‚ˆœØ]™K\\ÂˆÚYˆŒœÂˆZYÚˆŒœÂˆB‚ˆ˜YY›Ü›HÂˆY[™ÎˆN\ÂˆB‚ˆ™›Ü›KYÜšYÂˆØ\ˆLÂˆBŸB‚YYXH
™Y™\œË\™YXÙY[[Ý[ÛŽˆ™YXÙJHÂˆ
‹ˆ
ŽŽ˜™Y›Ü™Kˆ
ŽŽ˜Y\ˆÂˆØÜ›ÛX™Z]š[ÜŽˆ]]ÈZ[\Ü[Âˆ[š[X][Û‹Y\˜][ÛŽˆŒ[\ÈZ[\Ü[Âˆ[š[X][Û‹Z]\˜][Û‹XÛÝ[ˆHZ[\Ü[Âˆ˜[œÚ][Û‹Y\˜][ÛŽˆŒ[\ÈZ[\Ü[ÂˆBŸB