# Radar Room — CS2 Stratbook

Ein Stratbook für ein CS2-Team. Läuft als normale Website im Browser, lässt sich
auf Handy und PC als App installieren und synchronisiert alle Strats live über
eine gemeinsame Datenbank.

Drin sind alle sieben Active-Duty-Maps (Season 5: Ancient, Anubis, Cache,
Dust II, Inferno, Mirage, Nuke, letztere zusätzlich mit unterer Etage),
Zeichenwerkzeuge auf dem Radar, Utility mit Wurflinien, Spieler-Marker,
Aufstellung und Ablauf pro Strat, drei Phasen zum Durchklicken eines Executes
und 26 fertige Standard-Strats als Startpunkt.

---

## Einrichten

Einmalig, dauert ungefähr eine Viertelstunde. Danach müssen die Mitspieler nur
den Link öffnen und sich einmal anmelden.

### 1. Datenbank anlegen (Supabase, kostenlos)

1. Auf [supabase.com](https://supabase.com) anmelden und ein neues Projekt
   anlegen. Region Frankfurt nehmen, das ist die kürzeste Strecke.
2. Im Projekt links auf **SQL Editor**, dann **New query**.
3. Den kompletten Inhalt von `supabase-schema.sql` reinkopieren und **Run**
   drücken. Das legt die Tabellen an, schaltet die Zugriffsregeln scharf und
   aktiviert den Live-Sync.

### 2. Team-Zugang anlegen

1. Links auf **Authentication**, dann **Users**, dann **Add user** und
   **Create new user**.
2. E-Mail und Passwort eintragen, zum Beispiel `stratbook@deinedomain.de`.
   Wichtig: **Auto Confirm User** anhaken, sonst wartet der Account auf eine
   Bestätigungsmail.
3. Diese Zugangsdaten bekommt später das ganze Team.

Wenn du lieber einen Account pro Spieler willst: einfach fünf Nutzer anlegen.
Die App funktioniert mit beidem, ohne Änderung am Code.

### 3. Schlüssel eintragen

1. Links auf **Project Settings**, dann **API**.
2. **Project URL** und den **anon public** Key kopieren.
3. In `config.js` eintragen:

```js
window.RR_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

Der anon-Key darf öffentlich im Code stehen, dafür ist er gemacht. Ohne
Anmeldung kommt damit niemand an die Daten, das regeln die Zugriffsregeln aus
Schritt 1.

### 4. Online stellen (GitHub Pages)

1. Neues Repository auf GitHub anlegen, zum Beispiel `radar-room`.
2. Den kompletten Inhalt dieses Ordners reinladen, entweder per
   `git push` oder über **Add file → Upload files** im Browser.
3. Im Repo auf **Settings → Pages**, unter *Source* **Deploy from a branch**
   wählen, Branch `main` und Ordner `/ (root)`, dann **Save**.
4. Nach ein bis zwei Minuten liegt die Seite unter
   `https://DEINNAME.github.io/radar-room/`.

Eigene Domain, etwa `stratbook.voidcrafts.de`: im Repo unter **Settings → Pages
→ Custom domain** eintragen und beim Domain-Anbieter einen CNAME auf
`DEINNAME.github.io` setzen.

### 5. Ans Team geben

Link, E-Mail und Passwort ins Discord. Jeder öffnet den Link, meldet sich
einmal an und bleibt danach eingeloggt. Im Browser über das Menü
**Zum Startbildschirm hinzufügen** beziehungsweise den Installieren-Knopf oben
rechts wird daraus eine App mit eigenem Icon.

---

## Wie es sich bedient

**Zeichnen.** Werkzeugleiste links neben der Map: Auswählen und Verschieben,
Freihand, Pfeil, Linie, Zone, Spieler-Marker, Utility, Text, Löschen und
Verschieben der Ansicht. Die Buchstaben `V P A L R M U T E H` schalten direkt
um, `Strg + Z` macht rückgängig. Farbe unten in der Leiste.

**Utility.** Werkzeug wählen, dann Sorte (Smoke, Flash, Molo, HE, Decoy)
festlegen. Ein Klick setzt den Landepunkt. Ziehst du stattdessen von deiner
Position zum Landepunkt, entsteht eine gestrichelte Wurflinie.

**Phasen.** Oben `1 2 3`. Alles, was du zeichnest, hängt an der gerade
gewählten Phase. Beim Durchschalten bleibt der Rest als blasses Geisterbild
stehen, so kannst du einen Execute Schritt für Schritt zeigen statt alles auf
einmal.

**Presets.** Der Knopf oben rechts zeigt Standard-Executes für die gerade
gewählte Map. Übernehmen legt eine editierbare Kopie in eurem Buch an, mit
Rollen und Ablauf. Die Zeichnung macht ihr selbst, damit da keine erfundenen
Spots drinstehen.

**Als Text kopieren.** Unten im rechten Bereich. Wirft die Strat als sauberen
Block raus, den du direkt ins Discord pasten kannst.

---

## Gut zu wissen

- **Offline.** Die App läuft ohne Netz weiter, die Maps sind lokal gespeichert.
  Änderungen ohne Verbindung werden gesammelt und automatisch nachgeschickt,
  sobald wieder Netz da ist. Der Punkt neben deinem Namen oben zeigt den
  Zustand.
- **Kostenlose Supabase-Projekte pausieren** nach etwa einer Woche ohne Zugriff.
  Falls das Buch mal nicht lädt: im Supabase-Dashboard auf **Restore**, dann
  läuft es nach ein paar Minuten wieder. Wer regelmäßig reinschaut, merkt davon
  nichts.
- **Ohne `config.js`-Werte** läuft die App im Nur-lokal-Modus: alles bleibt im
  Browser des jeweiligen Geräts. Praktisch zum Ausprobieren, bevor die Datenbank
  steht.
- **Gleichzeitiges Bearbeiten.** Wer zuletzt speichert, gewinnt. Für ein Team,
  das sich im Voice abspricht, reicht das. Zwei Leute sollten nicht dieselbe
  Strat gleichzeitig zeichnen.
- **Updates am Code:** Dateien im Repo ersetzen, dann in `sw.js` die Zeile
  `const VERSION = "rr-v1";` auf `rr-v2` und so weiter hochzählen. Sonst
  bekommen installierte Geräte die alte Version aus dem Cache.

## Was wo liegt

```
index.html              Aufbau der Seite
app.css                 Gestaltung
app.js                  Logik: Zeichnen, Speichern, Anmeldung, Sync
config.js               deine Supabase-Zugangsdaten
data/maps.js            Maps mit Größe und Bildpfad
data/presets.js         die 26 Vorschlag-Strats
assets/radars/*.webp    Radar-Overviews aus den Spieldateien
assets/vendor/          Supabase-Bibliothek, lokal statt aus dem Netz
sw.js                   Offline-Cache
manifest.webmanifest    macht die Seite installierbar
supabase-schema.sql     Datenbank-Aufbau
```

Die Radar-Bilder stammen aus den CS2-Spieldateien und gehören Valve. Für ein
internes Team-Stratbook ist das üblich, für eine öffentlich vermarktete Seite
solltest du das anders lösen.

## Eigene Strats ergänzen

Die Presets in `data/presets.js` sind reiner Text, da kannst du gefahrlos
eigene ergänzen. Aufbau pro Eintrag: `name`, `side` (`"T"` oder `"CT"`),
`tags`, `roles` (fünf Rollen), `steps` (Ablauf) und `util`
(Paare aus Sorte und Spot). Neue Map ergänzen geht in `data/maps.js`, dazu das
Radar-Bild nach `assets/radars/` legen und Breite und Höhe eintragen.
