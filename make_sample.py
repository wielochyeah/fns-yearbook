#!/usr/bin/env python3
"""Erzeugt eine Beispiel-Excel-Datei im *echten* Formular-Export-Format.

Die relevanten Spalten stehen wie im echten Sheet:
  B = Name, S = Main character energy, T = Feinschmecker,
  U = Bücherwurm, V = DIY-Talent, W = Chaos-Level.
Alle übrigen Spalten existieren ebenfalls (mit Kopfzeile), werden aber
ignoriert – die Zuordnung erfolgt über die Kopfzeilen-Namen.
"""

import openpyxl

# Volle Kopfzeile A..Z wie im echten Export
HEADER = [
    "IDNR",                                                              # A
    "Name",                                                              # B
    "E-Mail",                                                            # C
    "Geburtsjahr",                                                       # D
    "Die Foto-Richtlinien habe ich zur Kenntnis genommen.",             # E
    "Stipendiat seit (bitte wählt zunächst das Semester und dann das "
    "Kalenderjahr, in dem ihr aufgenommen wurdet)",                     # F
    "Foto",                                                             # G
    "-",                                                                 # H
    "Ort von Studium/Promotion/Ausbildung",                             # I
    "Universität/Hochschule/Ausbildungsstätte",                         # J
    "Angestrebter Abschluss",                                           # K
    "Studienfach/Promotionsthema/Ausbildungsberuf",                     # L
    "Beschreibe dein Jahr 2025 in drei Worten",                         # M
    "Welche Werte sind dir im Leben unverhandelbar?",                   # N
    "Mit welcher Person (lebendig oder Tod) würdest du gerne zu "
    "Abendessen?",                                                      # O
    "Welche politische Idee würdest du direkt umsetzen, wenn du "
    "könntest?",                                                        # P
    "Welche völlig nutzlose Fähigkeit beherrscht du perfekt?",          # Q
    "Was heißt liberal sein im Hier und Jetzt?",                        # R
    "Main character energy",                                            # S
    "Feinschmecker",                                                    # T
    "Bücherwurm",                                                       # U
    "DIY-Talent",                                                       # V
    "Chaos-Level",                                                      # W
    "Ich möchte verbindlich eine Printausgabe bestellen.",             # X
    "Wunsch-Lieferadresse",                                            # Y
    "Die Datenschutz-Richtlinien habe ich zur Kenntnis genommen.",     # Z
]

# Spaltenindizes der relevanten Felder (0-basiert)
I_IDNR, I_NAME = 0, 1
I_DREIWORTE, I_WERTE, I_PERSON, I_IDEE, I_FAEHIGKEIT, I_LIBERAL = 12, 13, 14, 15, 16, 17
I_MCE, I_FEIN, I_BUCH, I_DIY, I_CHAOS = 18, 19, 20, 21, 22

# (IDNR, Name, MCE, Feinschmecker, Bücherwurm, DIY-Talent, Chaos-Level, texte)
# In den Freitexten stecken absichtlich ein paar Tippfehler (zum Testen der
# Rechtschreibprüfung): Freihheit, demokratiche, chaotsich, Verantwortunng,
# Abeneteuer, Nachaltigkeit.
PEOPLE = [
    (191290715, "Jolina Schlaß", 80, 100, 70, 20, 70, {
        I_DREIWORTE: "Mut, Freihheit, Aufbruch",
        I_WERTE: "Freiheit, Verantwortung, Offenheit und Respekt.",
        I_PERSON: "Louise Otto-Peters – als Schriftstellerin und Journalistin.",
        I_IDEE: "Mehr politische Teilhabe im ländlichen Raum.",
        I_FAEHIGKEIT: "Unnütze Funfacts merken.",
        I_LIBERAL: "Liberal sein heißt, für demokratiche Werte einzustehen.",
    }),
    (191290716, "Max Mustermann", 40, 65, 38, 20, 55, {
        I_DREIWORTE: "Neugierig, kreativ, chaotsich",
        I_WERTE: "Ehrlichkeit und Offenheit sind mir wichtig.",
        I_PERSON: "Ada Lovelace, weil sie ihrer Zeit voraus war.",
        I_IDEE: "Mehr Investitionen in Bildung und Forschung.",
        I_FAEHIGKEIT: "Ich kann jede Melodie nachpfeifen.",
        I_LIBERAL: "Eigenverantwortung und Toleranz im Alltag leben.",
    }),
    (191290717, "Mia Bauer", 82, 30, 90, 45, 12, {
        I_DREIWORTE: "Ruhig, strukturiert, verlässlich",
        I_WERTE: "Ehrlichkeit und Verantwortunng gegenüber anderen.",
        I_PERSON: "Hannah Arendt – über das Denken sprechen.",
        I_IDEE: "Echte Nachaltigkeit in der Wirtschaft verankern.",
        I_FAEHIGKEIT: "Ich erinnere mir jedes Geburtsdatum.",
        I_LIBERAL: "Freiheit endet da, wo die der anderen beginnt.",
    }),
    (191290718, "Jonas Klein", 8, 95, 15, 70, 78, {
        I_DREIWORTE: "Spontan, abeneteuerlich, offen",
        I_WERTE: "Gerechtigkeit und Solidarität zählen für mich.",
        I_PERSON: "Richard Feynman, ein begnadeter Erklärer.",
        I_IDEE: "Bürokratie spürbar abbauen und vereinfachen.",
        I_FAEHIGKEIT: "Ich kann rückwärts sauber einparken.",
        I_LIBERAL: "Mündige Bürger entscheiden selbst über ihr Leben.",
    }),
]


def make_row(idnr, name, mce, fein, buch, diy, chaos, texts):
    row = [None] * len(HEADER)
    row[I_IDNR] = idnr
    row[I_NAME] = name
    row[I_MCE] = mce
    row[I_FEIN] = fein
    row[I_BUCH] = buch
    row[I_DIY] = diy
    row[I_CHAOS] = chaos
    for col, text in texts.items():
        row[col] = text
    return row


def main() -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Export"
    ws.append(HEADER)
    for person in PEOPLE:
        ws.append(make_row(*person))
    out = "example/beispiel.xlsx"
    wb.save(out)
    print(f"geschrieben: {out}")


if __name__ == "__main__":
    main()
