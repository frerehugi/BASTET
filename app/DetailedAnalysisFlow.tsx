"use client";

// Liefert Stufe 2 (Detailanalyse) aus dem fertig ausgefüllten Fragebogen.
// Zwei Wege, je nach PAYWALL_ENABLED (lib/paywall.ts):
//   - Kill-Switch aus (Default): direkter POST an /api/detailed-assessment,
//     kein Stripe, kein Zahlungsschritt.
//   - Kill-Switch an: Stripe Express Checkout Element (Apple Pay/Google Pay),
//     mit gesetzlich vorgeschriebener Widerrufsverzicht-Checkbox davor.
//     Komplett getrennt von lib/x402.ts/app/api/premium — das hier ist die
//     Stripe-Zahlungsschiene für Endnutzer:innen, keine Krypto-/x402-Zahlung.
//
// Sicherheitsprinzip (nur im Kill-Switch-an-Fall relevant): Der Client
// erfährt "bezahlt" NUR über eine erfolgreiche Antwort von
// /api/detailed-assessment - die wiederum nur liefert, wenn der Stripe-
// Webhook (app/api/stripe/webhook) die Session serverseitig als bezahlt
// markiert hat. Ein hier clientseitig als "erfolgreich" erkannter
// stripe.confirmPayment()-Aufruf allein schaltet nichts frei.

import { useEffect, useState } from "react";
import { loadStripe, type Stripe as StripeClient } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import type { Stage1Answers, Stage2Answers } from "@/lib/interviewAnswers";
import { splitReferences } from "@/lib/format";
import {
  isMdeEinschlaegig,
  mentionsNonHealthSector,
  composeBgwLetter,
  formatDateDe,
  LETTER_SEND_HINT,
  OTHER_SECTOR_NOTICE,
  type LetterFields,
} from "@/lib/bgwLetter";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 8; // ~12s Puffer, bis der Webhook eingetroffen sein sollte

let stripePromiseCache: Promise<StripeClient | null> | null = null;

function getStripePromise(): Promise<StripeClient | null> {
  if (!stripePromiseCache) {
    stripePromiseCache = fetch("/api/stripe/config")
      .then((r) => r.json())
      .then((data: { publishableKey?: string }) => {
        if (!data.publishableKey) throw new Error("Stripe ist nicht konfiguriert.");
        return loadStripe(data.publishableKey);
      });
  }
  return stripePromiseCache;
}

interface Props {
  stage1: Stage1Answers;
  stage2: Stage2Answers;
  diagnosisConfirmed: boolean;
  paywallEnabled: boolean;
}

type Phase = "loading" | "offer" | "polling" | "done" | "error";

export default function DetailedAnalysisFlow({ stage1, stage2, diagnosisConfirmed, paywallEnabled }: Props) {
  const [phase, setPhase] = useState<Phase>(paywallEnabled ? "offer" : "loading");
  const [agreed, setAgreed] = useState(false);
  const [priceLabel, setPriceLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [refsOpen, setRefsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterFields, setLetterFields] = useState<LetterFields>({
    name: "",
    address: "",
    date: formatDateDe(new Date()),
  });
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [letterCopied, setLetterCopied] = useState(false);

  async function copyResult(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // stiller Fehlschlag, Button bleibt nutzbar
    }
  }
  async function copyLetter(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setLetterCopied(true);
      setTimeout(() => setLetterCopied(false), 2000);
    } catch {
      // stiller Fehlschlag, Button bleibt nutzbar
    }
  }

  useEffect(() => {
    if (paywallEnabled) {
      fetch("/api/pricing")
        .then((r) => r.json())
        .then((data: { formatted?: string }) => setPriceLabel(data.formatted ?? null))
        .catch(() => setPriceLabel(null));
      return;
    }
    // Kill-Switch aus: sofort und direkt anfordern, kein Zahlungsschritt.
    (async () => {
      try {
        const response = await fetch("/api/detailed-assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage1, stage2, diagnosisConfirmed }),
        });
        const data: { text?: string; error?: string } = await response.json();
        if (response.ok && data.text) {
          setResultText(data.text);
          setPhase("done");
        } else {
          setErrorMessage(data.error || "Unbekannter Fehler bei der Detailanalyse.");
          setPhase("error");
        }
      } catch (e) {
        setErrorMessage("Technisches Problem: " + (e instanceof Error ? e.message : "unbekannter Fehler"));
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pollForResult(sessionId: string, attempt: number) {
    try {
      const response = await fetch("/api/detailed-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data: { text?: string; error?: string; pending?: boolean } = await response.json();

      if (response.ok && data.text) {
        setResultText(data.text);
        setPhase("done");
        return;
      }

      if (data.pending && attempt < MAX_POLL_ATTEMPTS) {
        setTimeout(() => pollForResult(sessionId, attempt + 1), POLL_INTERVAL_MS);
        return;
      }

      setErrorMessage(
        data.pending
          ? "Die Zahlung wurde ausgeführt, die Bestätigung dauert aber ungewöhnlich lange. Bitte in ein bis zwei Minuten erneut versuchen — Ihre Zahlung ist nicht verloren."
          : data.error || "Unbekannter Fehler bei der Detailanalyse."
      );
      setPhase("error");
    } catch (e) {
      setErrorMessage(
        "Technisches Problem beim Abrufen der Detailanalyse: " + (e instanceof Error ? e.message : "unbekannter Fehler")
      );
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <div style={styles.wrap}>
        <p style={styles.pendingText}>Detailanalyse wird erstellt — das kann bis zu einer Minute dauern …</p>
      </div>
    );
  }

  if (phase === "done" && resultText) {
    const { body, refs } = splitReferences(resultText);
    return (
      <div style={styles.wrap}>
        <div style={styles.doneHeader}>✅ Detailanalyse</div>
        <div style={styles.resultBox}>{body}</div>
        {refs && (
          <div style={styles.refsArea}>
            <button style={styles.retryButton} onClick={() => setRefsOpen((o) => !o)}>
              {refsOpen ? "Referenzen ausblenden" : `Referenzen anzeigen (${refs.length})`}
            </button>
            <button style={styles.retryButton} onClick={() => copyResult(resultText)}>
              {copied ? "Kopiert ✓" : "Auswertung kopieren"}
            </button>
            {refsOpen && (
              <ul style={styles.refsList}>
                {refs.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {refs &&
          isMdeEinschlaegig(body) &&
          (mentionsNonHealthSector(stage1.beruf) ? (
            <p style={styles.otherSectorNotice}>{OTHER_SECTOR_NOTICE}</p>
          ) : (
            <div style={{ marginTop: 10 }}>
              {!letterOpen && (
                <button style={styles.retryButton} onClick={() => setLetterOpen(true)}>
                  Brief an die Berufsgenossenschaft erstellen
                </button>
              )}
              {letterOpen && (
                <div style={styles.letterForm}>
                  <label style={styles.letterLabel}>
                    Name
                    <input
                      style={styles.letterInput}
                      value={letterFields.name}
                      onChange={(e) => setLetterFields((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Vor- und Nachname"
                    />
                  </label>
                  <label style={styles.letterLabel}>
                    Adresse
                    <textarea
                      style={styles.letterTextarea}
                      rows={2}
                      value={letterFields.address}
                      onChange={(e) => setLetterFields((f) => ({ ...f, address: e.target.value }))}
                      placeholder={"Straße Hausnr.\nPLZ Ort"}
                    />
                  </label>
                  <label style={styles.letterLabel}>
                    Datum
                    <input
                      style={styles.letterInput}
                      value={letterFields.date}
                      onChange={(e) => setLetterFields((f) => ({ ...f, date: e.target.value }))}
                      placeholder="TT.MM.JJJJ"
                    />
                  </label>
                  <p style={styles.hint}>Diese Angaben bleiben ausschließlich in Ihrem Browser — sie werden nie an den Server gesendet oder gespeichert.</p>
                  <button
                    style={styles.retryButton}
                    onClick={() => setGeneratedLetter(composeBgwLetter(letterFields, body))}
                    disabled={!letterFields.name.trim() || !letterFields.address.trim()}
                  >
                    Brief erstellen
                  </button>
                </div>
              )}
              {generatedLetter && (
                <>
                  <pre style={styles.resultBox}>{generatedLetter}</pre>
                  <button style={styles.retryButton} onClick={() => copyLetter(generatedLetter)}>
                    {letterCopied ? "Kopiert ✓" : "Brief kopieren"}
                  </button>
                  <p style={styles.hint}>{LETTER_SEND_HINT}</p>
                </>
              )}
            </div>
          ))}
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {paywallEnabled && (
        <>
          <p style={styles.title}>Detailanalyse bezahlen{priceLabel ? ` — ${priceLabel}` : ""}</p>
          <p style={styles.desc}>
            Konkrete GdB-/MdE-Werte mit Quellenbelegen aus der amtlichen Wissensbasis (VersMedV,
            Gerichtsentscheidungen u. a.).
          </p>
        </>
      )}

      {phase === "polling" && <p style={styles.pendingText}>Zahlung wird bestätigt, bitte einen Moment warten …</p>}

      {phase === "error" && errorMessage && (
        <div style={styles.errorBox}>
          {errorMessage}
          <div style={{ marginTop: 8 }}>
            <button
              style={styles.retryButton}
              onClick={() => {
                setPhase(paywallEnabled ? "offer" : "loading");
                setErrorMessage(null);
              }}
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      )}

      {paywallEnabled && (phase === "offer" || phase === "error") && (
        <>
          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={styles.checkbox} />
            <span>
              Ich stimme zu, dass die Bereitstellung der digitalen Analyse sofort nach Zahlung beginnt, und bestätige,
              dass ich dadurch mein 14-tägiges Widerrufsrecht verliere (§ 356 Abs. 5 BGB).
            </span>
          </label>

          {!agreed && <p style={styles.hint}>Bitte zuerst oben bestätigen, um mit Apple Pay/Google Pay zu bezahlen.</p>}

          {agreed && (
            <ExpressCheckoutSection
              stage1={stage1}
              stage2={stage2}
              diagnosisConfirmed={diagnosisConfirmed}
              onPaid={(sessionId) => {
                setPhase("polling");
                pollForResult(sessionId, 0);
              }}
              onFailed={(message) => {
                setErrorMessage(message);
                setPhase("error");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function ExpressCheckoutSection(props: {
  stage1: Stage1Answers;
  stage2: Stage2Answers;
  diagnosisConfirmed: boolean;
  onPaid: (sessionId: string) => void;
  onFailed: (message: string) => void;
}) {
  const [amountCents, setAmountCents] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data: { cents?: number }) => setAmountCents(data.cents ?? null))
      .catch(() => setAmountCents(null));
  }, []);

  if (amountCents === null) {
    return <p style={styles.hint}>Zahlungsoptionen werden geladen …</p>;
  }

  return (
    <Elements stripe={getStripePromise()} options={{ mode: "payment", amount: amountCents, currency: "eur" }}>
      <ExpressCheckoutInner {...props} />
    </Elements>
  );
}

function ExpressCheckoutInner({
  stage1,
  stage2,
  diagnosisConfirmed,
  onPaid,
  onFailed,
}: {
  stage1: Stage1Answers;
  stage2: Stage2Answers;
  diagnosisConfirmed: boolean;
  onPaid: (sessionId: string) => void;
  onFailed: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [available, setAvailable] = useState<boolean | null>(null);

  async function handleConfirm(event: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) {
      event.paymentFailed({ reason: "fail", message: "Zahlung konnte nicht initialisiert werden." });
      onFailed("Zahlung konnte nicht initialisiert werden.");
      return;
    }

    const { error: submitError } = await elements.submit();
    if (submitError) {
      event.paymentFailed({ reason: "invalid_payment_data", message: submitError.message });
      onFailed(submitError.message || "Ungültige Zahlungsangaben.");
      return;
    }

    let sessionId: string;
    let clientSecret: string;
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage1, stage2, diagnosisConfirmed }),
      });
      const data: { sessionId?: string; clientSecret?: string; error?: string } = await response.json();
      if (!response.ok || !data.sessionId || !data.clientSecret) {
        throw new Error(data.error || "Zahlungsvorbereitung fehlgeschlagen.");
      }
      sessionId = data.sessionId;
      clientSecret = data.clientSecret;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Zahlungsvorbereitung fehlgeschlagen.";
      event.paymentFailed({ reason: "fail", message });
      onFailed(message);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      event.paymentFailed({ reason: "fail", message: confirmError.message });
      onFailed(confirmError.message || "Zahlung fehlgeschlagen.");
      return;
    }

    // Kein Redirect nötig (Apple Pay/Google Pay) - Zahlung wurde bestätigt.
    // Ob wirklich "bezahlt" gilt, entscheidet trotzdem erst der Webhook +
    // /api/detailed-assessment, siehe Kommentar oben in dieser Datei.
    onPaid(sessionId);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <ExpressCheckoutElement
        options={{
          paymentMethods: {
            applePay: "auto",
            googlePay: "auto",
            link: "never",
            paypal: "never",
            amazonPay: "never",
            klarna: "never",
          },
        }}
        onReady={(event) => setAvailable(!!event.availablePaymentMethods)}
        onConfirm={handleConfirm}
      />
      {available === false && <p style={styles.hint}>Apple Pay/Google Pay ist auf diesem Gerät/Browser gerade nicht verfügbar.</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    marginTop: 14,
    background: "var(--card)",
    border: "1px solid var(--border-gold)",
    borderRadius: 14,
    padding: "14px 16px",
  },
  title: { fontSize: 15.5, fontWeight: 700, color: "var(--gold-light)", margin: 0 },
  desc: { fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)", marginTop: 6 },
  pendingText: { fontSize: 13.5, color: "var(--text-muted)", marginTop: 10 },
  checkboxRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
    fontSize: 12.5,
    lineHeight: 1.55,
    color: "var(--text)",
  },
  checkbox: { marginTop: 3, flexShrink: 0 },
  hint: { fontSize: 12.5, color: "var(--text-faint)", marginTop: 8 },
  errorBox: {
    marginTop: 10,
    background: "rgba(248,113,113,.08)",
    border: "1px solid rgba(248,113,113,.35)",
    color: "var(--danger)",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13.5,
  },
  retryButton: {
    background: "rgba(255,255,255,.05)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  doneHeader: { fontSize: 15.5, fontWeight: 700, color: "var(--gold-light)" },
  resultBox: {
    marginTop: 10,
    whiteSpace: "pre-wrap",
    fontSize: 15,
    lineHeight: 1.65,
    color: "var(--text)",
  },
  refsArea: { marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 },
  refsList: { marginTop: 8, paddingLeft: 18, fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)", width: "100%" },
  otherSectorNotice: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 1.55,
    color: "var(--gold-light)",
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    borderRadius: 10,
    padding: "8px 10px",
  },
  letterForm: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "rgba(255,255,255,.03)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 12,
  },
  letterLabel: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--text)" },
  letterInput: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    color: "var(--text)",
  },
  letterTextarea: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical",
    color: "var(--text)",
  },
};
