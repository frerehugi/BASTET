# BASTET — Testfälle für die Vorbegutachtung

Sammlung realistischer Test-Prompts für die manuelle Stichproben-Prüfung der GdB/MdE-Auswertungen (Betroffenen-Arm `/` und Ärzte-Arm `/doc`), siehe `build/claude-code-buildplan.md`, Abschnitt "Nach dem Hackathon: was das Audit nicht abdeckt".

Jeder Fall ist bewusst als Rohtext notiert, so wie ihn eine betroffene Person im Chat eintippen könnte — nicht vorstrukturiert, damit das Interview selbst mitgetestet wird (Nachfragen, Turn-Budget, ob PEM/Dauer/Berufsbezug erfragt werden).

## Fall: Krankenschwester, beruflicher Zusammenhang (BK-3101-Kandidat)

> Krankenschwester, 42, Covid infekt 2022 auf der Arbeit im Krankenhaus, BG gemeldet, ein paar wochen krank, später immer wieder krank, schwindel, kopfschmerzen, schlechter schlaf, schlechte erholung, behandlung über hausarzt

**Antwort auf Nachfrage (PEM / Alltag / BG-Stand):**

> ja, nach starker belastung werde ich immer krank. das dauert manchmal mehrere wochen. Der Alltag ist schwierig, ich gehe abends um am wochenende kaum raus weil ich die erholung brauche, einkaufen geht manchmal, danach aber nichts mehr. nein, von der BG habe ich weiter nichts gehört.

**Antwort auf weitere Nachfrage (Arbeitsfähigkeit / BK-3101-Kenntnisstand):**

> Ja, ich arbeite mit halber Stelle. mehr geht nicht. Geld ist deswegen immer knapp. von einer BK 3101 weiss ich nichts

**Worauf beim Review achten:**
- Wird der berufliche Zusammenhang (Klinik, gemeldet bei der BG) korrekt aufgegriffen und führt zu einer **MdE-Einschätzung**, nicht nur zu "nicht einschlägig"?
- Wird nach PEM (post-exertionelle Malaise) gezielt nachgefragt, da im Rohtext nicht explizit genannt ("immer wieder krank" ist kein eindeutiges PEM-Signal)? Die Nachfrage-Antwort bestätigt PEM klar (Verschlechterung über Wochen nach Belastung) — wird das auch so benannt und referenziert (CCC-PEM-Kriterium)?
- BG-Status ist nuanciert: gemeldet, aber seit der Meldung **keine Rückmeldung** — das ist etwas anderes als "nicht gemeldet" oder "anerkannt". Erkennt die Auswertung diesen Zwischenstand korrekt (MdE-Einschätzung als Orientierung möglich, aber Rentenanspruch setzt eine erfolgte BK-3101-Anerkennung voraus) statt es pauschal als "nicht einschlägig" oder als "anerkannt" zu behandeln?
- Alltagsangaben (abends/Wochenende kaum raus, Einkaufen erschöpft sie vollständig) sind Bell-Score-relevant — fließen sie sichtbar in die GdB-Begründung ein?
- Halbtagsstelle als reduzierte Arbeitsfähigkeit ist ein weiteres GdB-relevantes Signal (Fatigue/Alltagsfunktion-Kategorie) — wird es aufgegriffen?
- Widerspruch/Unschärfe zwischen "BG gemeldet" (erste Antwort) und "von einer BK 3101 weiß ich nichts" (diese Antwort): realistisch, da Betroffene oft nur wissen, dass "etwas bei der BG lief", nicht die konkrete BK-Ziffer. Erkennt die Auswertung, dass eine Meldung bei der BG nicht automatisch eine bekannte/anerkannte BK-3101 bedeutet, und behandelt den MdE-Teil entsprechend vorsichtig-orientierend (z. B. Hinweis, dass der BK-3101-Status bei der zuständigen BG zu erfragen ist), statt fälschlich "nicht einschlägig, da keine BK-3101" zu schreiben?
- Wird die Dauer (≥6 Monate seit 2022) korrekt erkannt?
- Zieht die Auswertung passende Kalibrierungsanker heran (z. B. Schwindel/Kopfschmerz-Fälle aus `schlaf-schwindel-kognitiv-faelle.md`, BK-3101-Kausalitätsstufen aus `unfallversicherung-mde.md`) statt nur pauschal auf 18.4/3.7 zu verweisen?
- Bleibt die Antwort vollständig (GdB **und** MdE **und** Referenzen-Block), auch bei ausführlicher Begründung — siehe Commit `b151fb0` (Token-Budget-Fix vom 05.09.2026).

## Weitere Fälle

- Physiotherapeut:in-Fall — aus einer früheren Konversation erwähnt (`build/claude-code-buildplan.md`), Wortlaut hier noch nicht dokumentiert. Bei Gelegenheit nachtragen.
