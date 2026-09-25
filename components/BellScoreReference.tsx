"use client";

import { useState, type CSSProperties } from "react";
import { BELL_SCORE_DE, BELL_SCORE_SOURCE_URL } from "@/lib/bellScore";

/**
 * Auf-/zuklappbare deutsche Bell-Score-Tabelle als Nachschlagehilfe - geteilt
 * zwischen Doc-Arm (app/doc/page.tsx) und Tier-1-Triage (app/TriageFlow.tsx).
 * Reine Referenzanzeige, keine Auswahl/Eingabe; die Daten selbst liegen in
 * lib/bellScore.ts. Styling wird komplett von der aufrufenden Seite übergeben,
 * damit sich die Optik ins jeweilige Layout einfügt (gleiches Prinzip wie
 * components/AboutPanel.tsx).
 */
export function BellScoreReference({
  linkStyle,
  panelStyle,
  rowStyle,
  valueStyle,
  textStyle,
  sourceStyle,
}: {
  linkStyle?: CSSProperties;
  panelStyle?: CSSProperties;
  rowStyle?: CSSProperties;
  valueStyle?: CSSProperties;
  textStyle?: CSSProperties;
  sourceStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" style={linkStyle} onClick={() => setOpen((o) => !o)}>
        {open ? "Bell-Score – Deutsch ausblenden" : "Bell-Score – Deutsch"}
      </button>
      {open && (
        <div style={panelStyle}>
          {BELL_SCORE_DE.map((row) => (
            <div key={row.score} style={rowStyle}>
              <span style={valueStyle}>{row.score}</span>
              <span style={textStyle}>{row.text}</span>
            </div>
          ))}
          <p style={sourceStyle}>
            Quelle: David S. Bell, <em>The Doctor&apos;s Guide to Chronic Fatigue Syndrome</em>, S. 122 f.,
            Addison-Wesley Publishing Company, Reading, MA — deutsche Fassung: Charité Fatigue Centrum,
            Bell-Score 1995 (
            <a href={BELL_SCORE_SOURCE_URL} target="_blank" rel="noreferrer">
              PDF
            </a>
            ).
          </p>
        </div>
      )}
    </>
  );
}
