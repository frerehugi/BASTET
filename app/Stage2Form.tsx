"use client";

import { Section, Field, ChoiceGroup, MultiSelectGroup, SkippableTextArea, YesNoDetail, styles as fc } from "./FormControls";
import {
  HERZ_SYMPTOM_OPTIONS,
  CCC_KATEGORIEN,
  VORERKRANKUNG_OPTIONS,
  type Stage1Answers,
  type Stage2Answers,
  type VorerkrankungKey,
  type VorerkrankungDetail,
} from "@/lib/interviewAnswers";

interface Props {
  stage1: Stage1Answers;
  answers: Stage2Answers;
  onChange: (patch: Partial<Stage2Answers>) => void;
  onSubmit: () => void;
  loading: boolean;
}

const LATENZ_OPTIONS = [
  { value: "sofort", label: "Sofort" },
  { value: "stunden", label: "Nach Stunden" },
  { value: "folgetag", label: "Am Folgetag" },
  { value: "variiert", label: "Variiert" },
] as const;
const DAUER_OPTIONS = [
  { value: "unter14h", label: "Unter 14 Std." },
  { value: "ab14h", label: "14 Std. oder länger" },
  { value: "variiert", label: "Variiert" },
  { value: "weissNicht", label: "Weiß nicht" },
] as const;
const JNT_OPTIONS = [
  { value: "ja", label: "Ja" },
  { value: "nein", label: "Nein" },
  { value: "teilweise", label: "Teilweise" },
] as const;
const JN_OPTIONS = [
  { value: "ja", label: "Ja" },
  { value: "nein", label: "Nein" },
] as const;
const JNU_OPTIONS = [
  { value: "ja", label: "Ja" },
  { value: "nein", label: "Nein" },
  { value: "unsicher", label: "Unsicher" },
] as const;
const SCHWELLE_OPTIONS = [
  { value: "kurz", label: "Schon bei kurzer Anstrengung" },
  { value: "laenger", label: "Erst nach längerer/wiederholter Belastung" },
] as const;
const BEHANDELT_OPTIONS = [
  { value: "ja", label: "Behandelt/symptomatisch" },
  { value: "nein", label: "Nicht behandelt" },
  { value: "unauffaellig", label: "Unauffällig" },
] as const;

function countProgress(stage1: Stage1Answers, a: Stage2Answers): { answered: number; total: number } {
  const potsFollowUp = a.potsSymptome === "ja";
  const ptbsAsked = stage1.akutverlauf === "intensiv";

  const isSet = (v: unknown) => v !== null && v !== "" && v !== undefined;

  const fields: unknown[] = [
    a.belastungsartBeispiel,
    a.latenz,
    a.dauer,
    a.schlafErholsam,
    a.tagebuch,
    a.kognitivAlltagUndTestung,
    a.belastungsschwelle,
    a.riechSchmeck,
    a.beruflicheAbhaengigkeitSinne,
    a.potsSymptome,
    a.troponin,
    a.spiroergometrie,
    a.atemwege,
    a.psycheVorbestehend,
    a.andereEreignisse,
    a.aktivitaetseinschraenkung6mon,
    a.rehaUndArbeitsfaehigkeit,
  ];
  if (potsFollowUp) fields.push(a.stehtest, a.hautbiopsie);
  if (ptbsAsked) fields.push(a.ptbsHinweise);

  return { answered: fields.filter(isSet).length, total: fields.length };
}

export default function Stage2Form({ stage1, answers: a, onChange, onSubmit, loading }: Props) {
  const { answered, total } = countProgress(stage1, a);
  const vorerkrankungenZuFragen = stage1.vorerkrankungen.filter((k) => k !== "keine");

  function updateVorerkrankungDetail(key: VorerkrankungKey, patch: Partial<VorerkrankungDetail>) {
    onChange({
      vorerkrankungenDetail: {
        ...a.vorerkrankungenDetail,
        [key]: { behandelt: null, verschlechtert: null, ...a.vorerkrankungenDetail[key], ...patch },
      },
    });
  }

  return (
    <div>
      <p style={progressStyle}>
        {answered} von {total} Fragen beantwortet (Freitextfragen dürfen übersprungen werden)
      </p>

      <Section title="Fatigue / PEM">
        <Field label="9. Nach welcher Art Belastung tritt eine Verschlechterung auf (körperlich/geistig/emotional/sensorisch)? Kurzes Beispiel aus der letzten Zeit?">
          <SkippableTextArea value={a.belastungsartBeispiel} onChange={(v) => onChange({ belastungsartBeispiel: v })} />
        </Field>
        <Field label="10. Latenz bis Einsetzen">
          <ChoiceGroup value={a.latenz} onChange={(v) => onChange({ latenz: v })} options={LATENZ_OPTIONS} />
        </Field>
        <Field label="Dauer der Verschlechterung">
          <ChoiceGroup value={a.dauer} onChange={(v) => onChange({ dauer: v })} options={DAUER_OPTIONS} />
        </Field>
        <Field label="11. Ist der Schlaf trotz ausreichender Zeit im Bett erholsam?">
          <ChoiceGroup value={a.schlafErholsam} onChange={(v) => onChange({ schlafErholsam: v })} options={JNT_OPTIONS} />
        </Field>
        <Field label="12. Führen Sie ein Tagebuch zu solchen Episoden?">
          <ChoiceGroup value={a.tagebuch} onChange={(v) => onChange({ tagebuch: v })} options={JN_OPTIONS} />
          {a.tagebuch === "nein" && (
            <p style={fc.fieldHint}>
              Empfehlung: Vor einer förmlichen Begutachtung ein kurzes Tagebuch zu PEM-Episoden führen (Auslöser, Latenz,
              Dauer) — das erleichtert eine spätere Einschätzung erheblich.
            </p>
          )}
        </Field>
      </Section>

      <Section title="Kognitiv">
        <Field label="13. Welche Alltagssituationen sind betroffen, und wurde das formell getestet (z.B. MoCA)?">
          <SkippableTextArea value={a.kognitivAlltagUndTestung} onChange={(v) => onChange({ kognitivAlltagUndTestung: v })} />
        </Field>
        <Field label="14. Treten die Probleme schon bei kurzer Anstrengung auf, oder erst nach längerer/wiederholter Belastung?">
          <ChoiceGroup value={a.belastungsschwelle} onChange={(v) => onChange({ belastungsschwelle: v })} options={SCHWELLE_OPTIONS} />
        </Field>
      </Section>

      <Section title="Riech-/Schmeckstörung">
        <Field label="15. Vollständiger Verlust oder Verzerrung? Seit wann, ein-/beidseitig, standardisiert getestet?">
          <SkippableTextArea value={a.riechSchmeck} onChange={(v) => onChange({ riechSchmeck: v })} />
        </Field>
        <Field label="16. Beruflich in besonderem Maße auf Geruchs-/Geschmackssinn angewiesen?">
          <YesNoDetail value={a.beruflicheAbhaengigkeitSinne} onChange={(v) => onChange({ beruflicheAbhaengigkeitSinne: v })} />
        </Field>
      </Section>

      <Section title="Kreislauf / PoTS">
        <Field label="17. Schwindel oder Herzrasen beim Aufstehen?">
          <ChoiceGroup value={a.potsSymptome} onChange={(v) => onChange({ potsSymptome: v })} options={JN_OPTIONS} />
        </Field>
        {a.potsSymptome === "ja" && (
          <>
            <Field label="Wurde ein Stehtest mit Herzfrequenzmessung gemacht, mit welchem Ergebnis?">
              <SkippableTextArea value={a.stehtest} onChange={(v) => onChange({ stehtest: v })} />
            </Field>
            <Field label="Wurde eine Hautbiopsie zum Nachweis/Ausschluss einer Small-Fiber-Neuropathie gemacht?">
              <SkippableTextArea value={a.hautbiopsie} onChange={(v) => onChange({ hautbiopsie: v })} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Herz-Kreislauf">
        <Field label="18. Symptome" hint="Mehrfachauswahl möglich.">
          <MultiSelectGroup
            values={a.herzSymptome}
            onToggle={(key) =>
              onChange({
                herzSymptome: a.herzSymptome.includes(key) ? a.herzSymptome.filter((s) => s !== key) : [...a.herzSymptome, key],
              })
            }
            options={HERZ_SYMPTOM_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          />
        </Field>
        <Field label="War ein Troponin-Wert in der Akutphase erhöht, falls bekannt?">
          <SkippableTextArea value={a.troponin} onChange={(v) => onChange({ troponin: v })} />
        </Field>
        <Field label="19. Letztes Belastungs-/Spiroergometrie-Ergebnis, falls bekannt">
          <SkippableTextArea value={a.spiroergometrie} onChange={(v) => onChange({ spiroergometrie: v })} />
        </Field>
      </Section>

      <Section title="Atemwege">
        <Field label="20. Atemnot (Belastung/Ruhe) oder chronischer Husten? Wurden Spirometrie/Bodyplethysmographie/DLCO/Spiroergometrie durchgeführt?">
          <SkippableTextArea value={a.atemwege} onChange={(v) => onChange({ atemwege: v })} />
        </Field>
      </Section>

      <Section title="Psyche">
        <Field label="21. Bestanden depressive/ängstliche/traumabezogene Symptome bereits vor der Infektion?">
          <ChoiceGroup value={a.psycheVorbestehend} onChange={(v) => onChange({ psycheVorbestehend: v })} options={JNU_OPTIONS} />
        </Field>
        <Field label="22. Gab es andere belastende Ereignisse im relevanten Zeitraum, die die Symptomatik unabhängig erklären könnten?">
          <YesNoDetail value={a.andereEreignisse} onChange={(v) => onChange({ andereEreignisse: v })} />
        </Field>
        {stage1.akutverlauf === "intensiv" && (
          <Field label="23. Bestehen PTBS-Hinweise (Wiedererleben, Vermeidung, Übererregung) nach der intensivmedizinischen Behandlung?">
            <ChoiceGroup value={a.ptbsHinweise} onChange={(v) => onChange({ ptbsHinweise: v })} options={JNU_OPTIONS} />
          </Field>
        )}
      </Section>

      <Section title="ME/CFS-Doppelprüfung">
        <p style={fc.fieldHint}>Nutzt zusätzlich Ihre Antworten zu PEM/Schlaf (9-11) und kognitiv/orthostatisch (13-14, 17) — wird nicht erneut erfragt.</p>
        <Field label="24. Besteht seit mindestens 6 Monaten eine deutliche Aktivitätseinschränkung gegenüber der Zeit vor der Erkrankung, verbunden mit Müdigkeit?">
          <ChoiceGroup
            value={a.aktivitaetseinschraenkung6mon}
            onChange={(v) => onChange({ aktivitaetseinschraenkung6mon: v })}
            options={JN_OPTIONS}
          />
        </Field>
        <Field
          label="25. CCC-Zusatzsymptome"
          hint="Schmerzen sowie mindestens ein weiteres Symptom aus mindestens zwei der folgenden Kategorien."
        >
          {CCC_KATEGORIEN.map((kat) => (
            <div key={kat.key} style={{ marginBottom: 8 }}>
              <p style={{ ...fc.fieldHint, fontWeight: 600, color: "var(--text)" }}>
                {kat.label} <span style={fc.fieldHint}>({kat.beispiele})</span>
              </p>
              <input
                style={fc.textInput}
                placeholder="Symptome dieser Kategorie, Stichworte"
                value={a.cccSymptome.find((s) => s.startsWith(`${kat.key}:`))?.slice(kat.key.length + 1) ?? ""}
                onChange={(e) => {
                  const rest = a.cccSymptome.filter((s) => !s.startsWith(`${kat.key}:`));
                  const val = e.target.value.trim();
                  onChange({ cccSymptome: val ? [...rest, `${kat.key}:${val}`] : rest });
                }}
              />
            </div>
          ))}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={a.cccSymptome.includes("schmerzen:ja")}
              onChange={(e) => {
                const rest = a.cccSymptome.filter((s) => s !== "schmerzen:ja");
                onChange({ cccSymptome: e.target.checked ? [...rest, "schmerzen:ja"] : rest });
              }}
            />
            Schmerzen sind vorhanden
          </label>
        </Field>
      </Section>

      <Section title="Vorschäden & Verlauf">
        {vorerkrankungenZuFragen.length > 0 ? (
          <Field label="26. Für jede in Stufe 1 genannte Vorerkrankung">
            {vorerkrankungenZuFragen.map((key) => {
              const label = VORERKRANKUNG_OPTIONS.find((o) => o.key === key)?.label ?? key;
              const detail = a.vorerkrankungenDetail[key] ?? { behandelt: null, verschlechtert: null };
              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <p style={{ ...fc.fieldHint, fontWeight: 600, color: "var(--text)" }}>{label}</p>
                  <p style={fc.fieldHint}>War sie zum Infektionszeitpunkt behandelt/symptomatisch oder unauffällig?</p>
                  <ChoiceGroup
                    value={detail.behandelt}
                    onChange={(v) => updateVorerkrankungDetail(key, { behandelt: v })}
                    options={BEHANDELT_OPTIONS}
                  />
                  <p style={{ ...fc.fieldHint, marginTop: 8 }}>Hat sie sich durch die Infektion nach Ihrem Eindruck verschlechtert?</p>
                  <ChoiceGroup
                    value={detail.verschlechtert}
                    onChange={(v) => updateVorerkrankungDetail(key, { verschlechtert: v })}
                    options={JNU_OPTIONS}
                  />
                </div>
              );
            })}
          </Field>
        ) : (
          <p style={fc.fieldHint}>Keine Vorerkrankungen in Stufe 1 angegeben — Frage 26 entfällt.</p>
        )}
        <Field label="27. Wurde bereits eine Reha durchgeführt (wann/wie lange/Ergebnis)? Wie hat sich die Arbeitsfähigkeit seit der Infektion verändert?">
          <SkippableTextArea value={a.rehaUndArbeitsfaehigkeit} onChange={(v) => onChange({ rehaUndArbeitsfaehigkeit: v })} />
        </Field>
      </Section>

      <button style={submitStyle} onClick={onSubmit} disabled={loading}>
        {loading ? "Detailanalyse wird erstellt …" : "Detailanalyse erstellen"}
      </button>
    </div>
  );
}

const progressStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-faint)",
  marginBottom: 12,
};

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
  marginTop: 8,
};
