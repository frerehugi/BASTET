"use client";

import { useState, type CSSProperties } from "react";
import { BASTET_WALLET_ADDRESS } from "@/lib/content";

/**
 * Rendert den "Über BASTET / Rechtliches"-Text (app/page.tsx, app/doc/page.tsx)
 * und ersetzt darin die BASTET_WALLET_ADDRESS durch Adresse + Kopieren-Button,
 * statt den ganzen Block als reinen Fließtext auszugeben. Erwartet, dass
 * `text` die Adresse genau einmal enthält (bei PATIENT_ABOUT_TEXT der Fall) -
 * andernfalls Fallback auf reinen Text, damit ein künftiger Textwechsel ohne
 * Adresse nicht stillschweigend etwas verschluckt.
 */
export function AboutPanel({
  text,
  panelStyle,
  addressStyle,
  copyButtonStyle,
}: {
  text: string;
  panelStyle?: CSSProperties;
  addressStyle?: CSSProperties;
  copyButtonStyle?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  const parts = text.split(BASTET_WALLET_ADDRESS);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(BASTET_WALLET_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Stiller Fehlschlag (z. B. kein Clipboard-Zugriff) - Adresse bleibt im
      // Text weiterhin manuell markier-/kopierbar.
    }
  }

  if (parts.length !== 2) {
    return <div style={panelStyle}>{text}</div>;
  }

  return (
    <div style={panelStyle}>
      {parts[0]}
      <span style={addressStyle}>{BASTET_WALLET_ADDRESS}</span>
      <button type="button" style={copyButtonStyle} onClick={copyAddress}>
        {copied ? "Kopiert ✓" : "Kopieren"}
      </button>
      {parts[1]}
    </div>
  );
}
