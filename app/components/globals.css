"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EXPENSE_CATS,
  Expense,
  TRIP_DAYS,
  defaultTripDay,
  eur,
  parseAmount,
  sb,
} from "../lib";

type SplitMode = "50/50" | "nur_luca" | "nur_jan" | "custom";

const SPLIT_LABEL: Record<SplitMode, string> = {
  "50/50": "50 / 50",
  nur_luca: "Nur Luca",
  nur_jan: "Nur Jan",
  custom: "Eigene",
};

export default function ExpenseSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (e: Expense, toast: string) => void;
}) {
  const [day, setDay] = useState(defaultTripDay());
  const [cat, setCat] = useState("Essen");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState<"Luca" | "Jan">("Luca");
  const [split, setSplit] = useState<SplitMode>("50/50");
  const [customLuca, setCustomLuca] = useState("50");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDay(defaultTripDay());
      setError(null);
      setAmount("");
      setDesc("");
      setSaving(false);
      setTimeout(() => amountRef.current?.focus(), 250);
    }
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const parsed = useMemo(() => parseAmount(amount), [amount]);

  const splits = useMemo((): { luca: number; jan: number } | null => {
    if (split === "50/50") return { luca: 0.5, jan: 0.5 };
    if (split === "nur_luca") return { luca: 1, jan: 0 };
    if (split === "nur_jan") return { luca: 0, jan: 1 };
    const p = parseFloat(customLuca.replace(",", "."));
    if (!Number.isFinite(p) || p < 0 || p > 100) return null;
    const l = Math.round(p * 100) / 10000;
    return { luca: l, jan: Math.round((1 - l) * 10000) / 10000 };
  }, [split, customLuca]);

  async function save() {
    setError(null);
    if (!parsed) {
      setError("Bitte einen gültigen Betrag eingeben, z. B. 18,40.");
      amountRef.current?.focus();
      return;
    }
    if (!splits) {
      setError("Die eigene Aufteilung braucht einen Wert zwischen 0 und 100 %.");
      return;
    }
    setSaving(true);
    const dayInfo = TRIP_DAYS.find((d) => d.iso === day);
    const body = {
      expense_date: day,
      title: desc.trim() || cat,
      category: cat,
      amount: parsed,
      paid_by: payer,
      split_mode:
        split === "custom" ? `${Math.round(splits.luca * 100)}/${Math.round(splits.jan * 100)}` : SPLIT_LABEL[split],
      split_luca: splits.luca,
      split_jan: splits.jan,
      note: null,
      source: "app",
      travel_day: dayInfo ? `Tag ${dayInfo.nr}` : null,
    };
    try {
      const rows = await sb<Expense[]>("kreta_expenses", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const row = rows[0];
      onSaved(row, `Gespeichert: ${eur(parsed)} · ${cat} · ${payer} bezahlt`);
      onClose();
    } catch {
      setError("Speichern hat nicht geklappt. Verbindung prüfen und erneut versuchen.");
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Ausgabe eintragen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>Ausgabe eintragen</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <label className="field-label">Betrag</label>
        <div className="amount-wrap">
          <input
            ref={amountRef}
            className="amount-input"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Betrag in Euro"
          />
          <span className="amount-cur">€</span>
        </div>

        <label className="field-label">Reisetag</label>
        <div className="day-strip" role="radiogroup" aria-label="Reisetag">
          {TRIP_DAYS.map((d) => (
            <button
              key={d.iso}
              role="radio"
              aria-checked={day === d.iso}
              className={`day-chip ${day === d.iso ? "on" : ""}`}
              onClick={() => setDay(d.iso)}
            >
              <span className="day-nr">Tag {d.nr}</span>
              <span className="day-date">{d.label}</span>
            </button>
          ))}
        </div>

        <label className="field-label">Kategorie</label>
        <div className="chip-wrap">
          {EXPENSE_CATS.map((c) => (
            <button
              key={c.label}
              className={`chip ${cat === c.label ? "on" : ""}`}
              onClick={() => setCat(c.label)}
              aria-pressed={cat === c.label}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="exp-desc">
          Kurzbeschreibung <span className="opt">(optional)</span>
        </label>
        <input
          id="exp-desc"
          className="text-input"
          placeholder={`z. B. Taverne in Loutro`}
          value={desc}
          maxLength={80}
          onChange={(e) => setDesc(e.target.value)}
        />

        <label className="field-label">Bezahlt von</label>
        <div className="seg seg-2">
          {(["Luca", "Jan"] as const).map((p) => (
            <button
              key={p}
              className={payer === p ? "on" : ""}
              onClick={() => setPayer(p)}
              aria-pressed={payer === p}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="field-label">Aufteilung</label>
        <div className="seg seg-4">
          {(Object.keys(SPLIT_LABEL) as SplitMode[]).map((m) => (
            <button key={m} className={split === m ? "on" : ""} onClick={() => setSplit(m)} aria-pressed={split === m}>
              {SPLIT_LABEL[m]}
            </button>
          ))}
        </div>
        {split === "custom" && (
          <div className="custom-split">
            <label htmlFor="custom-luca">Anteil Luca</label>
            <div className="custom-split-input">
              <input
                id="custom-luca"
                inputMode="decimal"
                value={customLuca}
                onChange={(e) => setCustomLuca(e.target.value)}
              />
              <span>%</span>
            </div>
            <span className="muted">
              Jan: {(() => {
                const p = parseFloat(customLuca.replace(",", "."));
                return Number.isFinite(p) && p >= 0 && p <= 100 ? `${Math.round((100 - p) * 100) / 100} %` : "–";
              })()}
            </span>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="save-btn" onClick={save} disabled={saving}>
          {saving ? "Wird gespeichert…" : parsed ? `${eur(parsed)} speichern` : "Speichern"}
        </button>
      </div>
    </div>
  );
}
