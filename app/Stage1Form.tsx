"use client";

import { Section, Field, ChoiceGroup, MultiSelectGroup, styles as fc } from "./FormControls";
import { SYMPTOM_OPTIONS, VORERKRANKUNG_OPTIONS, type Stage1Answers } from "@/lib/interviewAnswers";

interface Props {
  answers: Stage1Answers;
  onChange: (patch: Partial<Stage1Answers>) => void;
  onSubmit: () => void;
  loading: boolean;
}

const NACHWEIS_OPTIONS = [
  { value: "pcr", label: "PCR" },
  { value: "schnelltest", label: "Schnelltest" },
  { value: "antikoerper", label: "Antikörper" },
  { value: "vermutet", label: "nur vermutet" },
] as const;

const AKUT_OPTIONS = [
  { value: "ambulant", label: "Ambulant" },
  { value: "normalstation", label: "Krankenhaus (Normalstation)" },
  { value: "intensiv", label: "Intensivmedizinisch" },
] as const;

const JNU_OPTIONS = [
  { value: "ja", label: "Ja" },
  { value: "nein", label: "Nein" },
  { value: "unsicher", label: "Unsicher" },
] as const;

const VERLAUF_OPTIONS = [
  { value: "durchgehend", label: "Durchgehend" },
  { value: "phasenweise", label: "Mit beschwerdefreien Phasen" },
  { value: "neu", label: "Neu wieder aufgetreten" },
] as const;

const TENDENZ_OPTIONS = [
  { value: "gebessert", label: "Eher gebessert" },
  { value: "gleich", label: "Gleich geblieben" },
  { value: "verschlechtert", label: "Verschlechtert" },
] as const;

export default function Stage1Form({ answers: a, onChange, onSubmit, loading }: Props) {
  return (
    <div>
      <Section title="Basisangaben">
        <Field label="1. Monat/Jahr der bestätigten SARS-CoV-2-Infektion">
          <input
            style={fc.textInput}
            value={a.infektionZeitpunkt}
            onChange={(e) => onChange({ infektionZeitpunkt: e.target.value })}
            placeholder="z.B. 03/2023"
          />
          <div style={{ marginTop: 8 }}>
            <ChoiceGroup value={a.nachweisart} onChange={(v) => onChange({ nachweisart: v })} options={NACHWEIS_OPTIONS} />
          </div>
        </Field>

        <Field label="2. Akutverlauf">
          <ChoiceGroup value={a.akutverlauf} onChange={(v) => onChange({ akutverlauf: v })} options={AKUT_OPTIONS} />
        </Field>

        <Field label="3. Beruf/Tätigkeit zum Infektionszeitpunkt" hint="Bitte konkrete Berufsbezeichnung.">
          <input
            style={fc.textInput}
            value={a.beruf}
            onChange={(e) => onChange({ beruf: e.target.value })}
            placeholder="z.B. Pflegefachkraft, Bürokauffrau, …"
          />
        </Field>

        <Field label="4. Beruflicher Kontakt zu nachweislich Infizierten?">
          <ChoiceGroup
            value={a.beruflicherKontakt}
            onChange={(v) => onChange({ beruflicherKontakt: v })}
            options={JNU_OPTIONS}
          />
        </Field>
        <Field label="Bereits BK-/Arbeitsunfall-Meldung bei BG/Unfallkasse?">
          <ChoiceGroup value={a.bkMeldung} onChange={(v) => onChange({ bkMeldung: v })} options={JNU_OPTIONS} />
        </Field>

        <Field label="5. Beginn der Beschwerden (Wochen nach Infektion)">
          <input
            style={fc.textInput}
            value={a.beschwerdebeginnWochen}
            onChange={(e) => onChange({ beschwerdebeginnWochen: e.target.value })}
            placeholder="z.B. 2"
            inputMode="numeric"
          />
        </Field>
        <Field label="Verlauf seither">
          <ChoiceGroup value={a.verlaufSeither} onChange={(v) => onChange({ verlaufSeither: v })} options={VERLAUF_OPTIONS} />
        </Field>

        <Field label="6. Gesamttendenz">
          <ChoiceGroup value={a.gesamttendenz} onChange={(v) => onChange({ gesamttendenz: v })} options={TENDENZ_OPTIONS} />
        </Field>

        <Field label="7. Symptomüberblick" hint="Mehrfachauswahl möglich.">
          <MultiSelectGroup
            values={a.symptome}
            onToggle={(key) =>
              onChange({
                symptome: a.symptome.includes(key as never)
                  ? a.symptome.filter((s) => s !== key)
                  : [...a.symptome, key as (typeof a.symptome)[number]],
              })
            }
            options={SYMPTOM_OPTIONS}
          />
          {a.symptome.includes("andere") && (
            <input
              style={{ ...fc.textInput, marginTop: 8 }}
              value={a.symptomeAndere}
              onChange={(e) => onChange({ symptomeAndere: e.target.value })}
              placeholder="Welche andere(n) Symptome?"
            />
          )}
        </Field>

        <Field label="8. Relevante Vorerkrankungen vor der Infektion" hint="Mehrfachauswahl möglich.">
          <MultiSelectGroup
            values={a.vorerkrankungen}
            onToggle={(key) =>
              onChange({
                vorerkrankungen: a.vorerkrankungen.includes(key as never)
                  ? a.vorerkrankungen.filter((v) => v !== key)
                  : [...a.vorerkrankungen, key as (typeof a.vorerkrankungen)[number]],
              })
            }
            options={VORERKRANKUNG_OPTIONS}
          />
        </Field>
      </Section>

      <button style={submitStyle} onClick={onSubmit} disabled={loading}>
        {loading ? "Schnell-Einschätzung wird erstellt …" : "Schnell-Einschätzung erstellen"}
      </button>
    </div>
  );
}

const submitStyle: React.CSSProperties = {
  width: "100%",
  background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
  color: "var(--dark2)",
  border: "none",
  borderRadius: 999,
  padding: "14px 20px",
  fontSize: 15.5,
  fontWeight: 700,
  cursor: "pointer",
};
