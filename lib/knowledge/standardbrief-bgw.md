# BASTET-Standardbrief: Aufforderung zur Einleitung diagnostischer/formeller Schritte

Gedacht als Textbaustein, der am Ende der Auswertung (Betroffenen-Arm) zum Kopieren/Herunterladen angeboten wird — analog zum bestehenden "Auswertung kopieren"-Button. Nutzt dieselbe No-Storage-Logik: der Brief wird clientseitig aus der Vorlage plus den im Gespräch genannten Eckdaten zusammengesetzt, nichts davon wird serverseitig gespeichert.

## Vorlage (Fließtext, mit Platzhaltern in eckigen Klammern)

```
[Ihr Name]
[Ihre Adresse]
[Ihre PLZ, Ort]

Berufsgenossenschaft für Gesundheitsdienst und Wohlfahrtspflege (BGW)
Hauptverwaltung
Pappelallee 33/35/37
22089 Hamburg

[Ort], den [Datum]

Betreff: Post-COVID-Syndrom nach beruflich bedingter COVID-19-Infektion —
Bitte um Einleitung weiterer Schritte
Ihr Zeichen / Aktenzeichen: [falls bekannt, sonst weglassen]

Sehr geehrte Damen und Herren,

wie Ihnen bekannt ist, habe ich im Rahmen meiner beruflichen Tätigkeit am
[Datum der Infektion, falls bekannt] einen COVID-19-Infekt erlitten. Zudem
leide ich unter anhaltenden Symptomen (u. a. [1–2 Stichworte aus der
Auswertung, z. B. "Fatigue, kognitive Einschränkungen, Belastungsintoleranz"]),
die ein Post-COVID-Syndrom und damit eine Anerkennung als Berufskrankheit
Nr. 3101 möglich erscheinen lassen.

Ich möchte Sie deshalb bitten, alle weiteren diagnostischen und formellen
Schritte einzuleiten und zu koordinieren — insbesondere die Prüfung, ob die
geschilderten Beschwerden als Folge der anerkannten beruflichen Infektion
einzuordnen sind, sowie die Veranlassung einer entsprechenden fachärztlichen
Begutachtung.

Meine Mitwirkungspflicht nach §§ 60 ff. SGB I habe ich hiermit vorerst erfüllt;
für weitere Angaben oder Unterlagen stehe ich selbstverständlich zur Verfügung.

Vielen Dank und mit freundlichen Grüßen,

[Ihr Name]
```

## Ergänzender Hinweistext, der ZUSAMMEN mit dem Brief angezeigt werden sollte (nicht Teil des Briefs selbst)

```
So verschicken Sie diesen Brief am zuverlässigsten:

1. Post (empfohlen): am besten per Einschreiben, damit Sie einen Nachweis über
   den Zugang haben — das kann später wichtig werden.
2. DGUV-Serviceportal (serviceportal-uv.dguv.de): der von der Unfallversicherung
   selbst empfohlene digitale Weg.
3. E-Mail (online-redaktion@bgw-online.de): allgemeine Kontaktadresse der BGW —
   für den Erstkontakt nutzbar, aber möglicherweise nicht für die sichere
   Übermittlung sensibler Gesundheitsangaben vorgesehen. Für die eigentliche
   Fallbearbeitung ist Post oder das Serviceportal vorzuziehen.

Falls Sie nicht bei der BGW, sondern einer anderen Berufsgenossenschaft
versichert sind: [Verweis auf Auswahl-/Ermittlungsmechanismus, sobald das
Interview nach dem Arbeitgeber-Sektor fragt]
```

## Designentscheidungen, die in diese Vorlage eingeflossen sind

- **Betreffzeile und Aktenzeichen-Feld ergänzt** — im Originalentwurf nicht enthalten, aber für einen Behördenbrief üblich und erhöht die Chance auf zügige Zuordnung.
- **Symptomstichworte als Platzhalter statt Freitext-Vorgabe**: Der Brief soll die individuelle Auswertung aufgreifen, nicht generisch bleiben — die zwei bis drei prägnantesten Symptome aus der Auswertung sollen automatisch eingesetzt werden, sobald das in der App umgesetzt ist.
- **"Bitte um Einleitung weiterer Schritte" statt eines konkreten Antrags**: Der Brief fordert **keine** bestimmte Leistung oder Anerkennung ein (das wäre der Sache nach eine Art Rechtsberatung, siehe `bastet-haftungsausschluss-urheberrecht.md`), sondern verweist auf die aktive Ermittlungspflicht der BGW selbst (§ 20 SGB X, siehe `bg-pflichten-mitwirkung.md`) und bittet lediglich um Koordination.
- **Mitwirkungspflicht-Satz bewusst übernommen und mit Rechtsgrundlage versehen**: Der Satz "Meine Mitwirkungspflicht habe ich hiermit vorerst erfüllt" aus dem Originalentwurf ist inhaltlich korrekt und rechtlich sinnvoll — er dokumentiert den Zeitpunkt der eigenen Mitwirkung nach außen sichtbar, was bei einer späteren Auseinandersetzung über § 66 SGB I (Versagung wegen fehlender Mitwirkung) hilfreich sein kann.
- **Kein Verweis auf einen bestimmten GdB/MdE-Wert im Brief** — der Brief bittet um Verfahrenseinleitung, nicht um eine bestimmte Bewertung; das entspricht dem Charakter von BASTET als Orientierungshilfe, nicht als Entscheidungsvorwegnahme.

## Offene Punkte für die Umsetzung in der App
- Automatisches Einsetzen von Name/Adresse/Datum erfordert Eingabefelder, die aktuell nicht im Interview abgefragt werden — Datenschutz-Abwägung nötig, da das personenbezogene Daten wären (Widerspruch zum No-Storage-Prinzip, falls zwischengespeichert; unproblematisch, falls rein clientseitig in die Zwischenablage kopiert und nirgends abgeschickt).
- Die zwei bis drei Symptomstichworte müssten aus der bereits generierten Auswertung extrahiert werden (ähnlich der REFERENZEN-Block-Logik) — technisch machbar, aber ein zusätzlicher Parsing-Schritt.
- Sprachliche Anpassung für den Ärzte-Arm nicht vorgesehen — der Brief richtet sich ausdrücklich an Betroffene, die selbst an die BGW schreiben; ein ärztliches Anschreiben (Meldung nach § 202 SGB VII) ist ein anderes, bereits an anderer Stelle behandeltes Thema.
