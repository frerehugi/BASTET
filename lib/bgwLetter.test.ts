// Regressionstest für die Verneinungserkennung in extractSymptomKeywords()
// (siehe commit 9ef3f3b). Der ursprüngliche Fehler: reines \b<keyword>\b-
// Matching ohne Satzkontext-Prüfung ließ "Kein PEM. Keine Fatigue. Keine
// kognitive Störung." fälschlich alle drei Symptome im Brief an die BGW
// landen — das Gegenteil der tatsächlichen Angabe. Dieser Test fixiert das
// korrekte Verhalten, damit ein künftiger Umbau der Funktion nicht wieder
// reines Keyword-Matching ohne Verneinungsprüfung einführt.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSymptomKeywords } from "./bgwLetter";

test("extractSymptomKeywords: reine Verneinung vor dem Symptom liefert keine Treffer", () => {
  const text = "Kein PEM. Keine Fatigue. Keine kognitive Störung.";
  assert.deepEqual(extractSymptomKeywords(text), []);
});

test("extractSymptomKeywords: bestätigte Symptome werden erkannt", () => {
  const text = "Deutliches PEM nach Belastung, ausgeprägte Fatigue, kognitive Störung im Alltag.";
  assert.deepEqual(extractSymptomKeywords(text), ["PEM", "Fatigue", "kognitive Störung"]);
});

test("extractSymptomKeywords: Verneinung nach dem Symptom ('wird verneint'/'liegt nicht vor')", () => {
  const text = "PEM wird verneint. Fatigue liegt nicht vor.";
  assert.deepEqual(extractSymptomKeywords(text), []);
});

test("extractSymptomKeywords: Kontrastwort im selben Satz hebt eine frühere Verneinung wieder auf", () => {
  const text = "Keine Fatigue im engeren Sinne, aber deutliche Konzentrationsstörung.";
  assert.deepEqual(extractSymptomKeywords(text), ["Konzentrationsstörung"]);
});

test("extractSymptomKeywords: Verneinung eines Symptoms verneint kein anderes im nächsten Satz", () => {
  const text = "Keine Fatigue. Deutliche Kurzatmigkeit bei Belastung.";
  assert.deepEqual(extractSymptomKeywords(text), ["Kurzatmigkeit"]);
});
