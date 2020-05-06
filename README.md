# Corona Deutschland Scraper (RKI)

Der RKI-Wrapper greift auf die API des Robert Koch-Instituts zu und gibt die ausgelieferten Daten in einer für Datawrapper geeigneten Form zurück.

Der Wrapper holt in einer einzelnen Anfrage die Daten bis zum gewählten End-Datum gemeldeten Fälle und aggregiert die Fallzahlen pro Tag und wahlweise nach weiteren Feldern, wie Altersgruppe oder Landkreis. Im Anschluss berechnet er die kumulative Summe der Fallzahlen vom ersten Meldetag an (=2020-01-24).

*Hinweis:* Um herauszufinden, welche Werte man in die Felder einsetzen kann, lohnt sich ein Blick in den [Überblick der Daten](https://npgeo-corona-npgeo-de.hub.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0/data).

Eine detaillierte Beschreibung der RKI-API findet sich in [RKI-API.md](./RKI-API.md):

## API

Für die Verwendung der Daten in Apps und interaktiven Grafiken (Datawrapper) stellen wir einen API bereit, die das Abfragen der RKI-Daten nach bestimmten Parametern (Zeitpunkt, Bundesland, Dateiformat) ermöglicht.

**URL:** <https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/>

### Parameter

- `startDate` *| optional | Default: '2020-01-24' (= erster Tag, den das RKI liefert)*: Gibt an, ab welchem Tag der Wrapper Daten zurück gibt. *Hinweis:* Die aggregierten Fallzahlen enthalten auch weiter zurückliegende Fälle als `fromDate`.
- `endDate` *| optional | Default: aktuelles Datum*: Gibt an, bis zu welchem Tag der Wrapper Daten zurück gibt
- `dateField` *| optional | Default: Meldedatum*: Gibt an, zu welchem Datum Fälle zählen. Mögliche Werte sind `Meldedatum` und `Refdatum`, wobei `Refdatum` den *Erkrankungsbeginn* (= Datum des Symptombeginns) darstellt. Dieser kann vor, aber auch nach dem `Meldedatum` liegen. Falls der Erkrankungsbeginn unbekannt ist, gilt dafür das Meldedatum.
- `sumField` *| optional | Default: AnzahlFall*: Gibt an, welche Werte summiert und ausgegeben werden. Mögliche Werte sind `AnzahlFall`, `AnzahlTodesfall` und `AnzahlGenesen`.
- `group` *| optional*: Gibt an, nach welchem Feld aggregiert wird. *Hinweis:* Bis jetzt nur einzelne Felder wählbar, z.B. `group=Geschlecht`.  Falls `group=Regierungsbezirk` gesetzt ist, muss auch der Filter `bundesland=Bayern` gesetzt sein
- `filetype` *| optional | Default: json*: Wählt das Ausgabeformat. *Hinweis:* Für Datawrapper wähle `format=csv`
- `geschlecht`, `altersgruppe`,`altersgruppe2`, `bundesland`, `landkreis`, `regierungsbezirk` *| optional*: Filtert die entsprechenden Felder. Mehrfachauswahl ist möglich, z.B. gibt `bundesland=Bayern&geschlecht=M` die Anzahl der gemeldeten infizierten Männer in Bayern zurück. Mehrfachauswahl innerhalb der Felder ist auch möglich, z.B. `landkreis=SK München,Sk Hamburg`. *Hinweis:* `altersgruppe2` teilt die Personen in 5-Jahresgruppen ein.
- `sumValue` *| optional | Default: true*: Tageswerte aufaddieren (Summe aller Gemeldeten bis zum jeweiligen Tag) oder nur die Fälle des jeweiligen Tages anzeigen. Nur wirksam bei `filetype=csv`.
- `newCases` *| optional | Default: false*: Alle Fälle oder nur die am Vortag neu gemeldeten Fälle ausgeben.

Allgemein Hinweise zur Verwendung der Parameter:

- Bei Mehrfachauswahl innerhalb eines Feldes sind die Werte mit `,` ohne Leerzeichen anzugeben.
- Die Filter-Keys sind in Kleinbuchstaben anzugeben, z.B. `bundesland`.
- Alle Werte sind ohne Anführungszeichen anzugeben.
- Die verschiedenen Filterfelder sind mit logischem `AND` verknüpft. Mehrfachauswahl innerhalb eines Feldes ist mit `OR` verknüpft.
- Abweichung der Schreibweise macht den Filter wirkungslos.
- Ergänzend zur Filterung ist es fast immer sinnvoll auch den Parameter `group` mit einem der Filterfelder zu besetzen.

### Beispiele

Entwicklung der Fallzahlen für Deutschland nach Erkennungsdatum abfragen:

```text
https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/query
  ?dateField=Refdatum
````

Entwicklung der Fallzahlen für Deutschland ab dem 12.03.2020 abfragen:

```text
https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/query
  ?startDate=2020-03-12
````

Entwicklung der Fallzahlen für Bayern abfragen:

```text
https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/query
  ?group=Bundesland
  &bundesland=Bayern
````

Entwicklung der Fallzahlen für alle bayerischen Regierungsbezirke abfragen:

```text
https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/query
  ?group=Regierungsbezirk
  &bundesland=Bayern
```

Entwicklung der Fallzahlen für drei spezifische Regierungsbezirke (Mittelfranken, Oberfranken, Unterfranken) als CSV-Tabelle abfragen:

```text
https://europe-west3-brdata-niels.cloudfunctions.net/rkiApi/query
  ?group=Regierungsbezirk
  &bundesland=Bayern
  &regierungsbezirk=Mittelfranken,Oberfranken,Unterfranken
  &filetype=csv
```

Entwicklung der Neuinfektionen für drei spezifische Regierungsbezirke (Mittelfranken, Oberfranken, Unterfranken) als CSV-Tabelle abfragen:

```text
https://europe-west3-brdata-niels.cloudfunctions.net/rkiApi/query
  ?group=Regierungsbezirk
  &bundesland=Bayern
  &regierungsbezirk=Mittelfranken,Oberfranken,Unterfranken
  &sumValue=false
  &filetype=csv
```

Entwicklung der Fallzahlen für alle bayerischen Landkreise abfragen:

```text
https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/query
  ?group=Landkreis
  &bundesland=Bayern
```

Entwicklung der Fallzahlen für den Landkreis Tirschenreuth abfragen:

```text
https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/query
  ?group=Landkreis
  &bundesland=Bayern
  &landkreis=LK Tirschenreuth
```

## Verwendung

1. Repository klonen `git clone https://...`
2. Erforderliche Module installieren `npm install`
3. Entwicklungsserver starten `npm watch`

Um die Module installieren und die Entwicklerwerkzeuge nutzen zu können, muss vorher die JavaScript-Runtime [Node.js](https://nodejs.org/en/download/) installiert werden. Informationen für Entwickler finden sich weiter [unten](#user-content-entwickeln).

## Deployment

Diese Anleitung geht davon aus, dass bereits ein Google Cloud-Konto vorhanden und ein Rechnungskonto eingerichtet ist. Außerdem sollte das Google Cloud-Kommandzeilenwerkzeug [installiert](https://cloud.google.com/sdk/install) und mit einem Benutzerkonto [verknüpft](https://cloud.google.com/sdk/docs/initializing) sein.

### Projekt anlegen

Neues Projekt mit der ID `brdata-corona` erstellen. Der Parameter `--name` ist optional.

```console
$ gcloud projects create brdata-corona --name=30-BRData-corona
```

Das Projekt als aktuelles Arbeitsprojekt festlegen:

```console
$ gcloud config set project brdata-corona
```

### API deployen

Google Cloud Function für das aktuelle Projekt aktivieren:

```console
$ gcloud services enable cloudfunctions.googleapis.com
```

Rechenzentrum *europe-west3* (Frankfurt) als Ziel für das Funktions-Deployment festlegen.

```console
$ gcloud config set functions/region europe-west3
```

API-Funktion deployen: In diesem Beispiel wird der nicht authentifizierte Zugriff von außerhalb erlaubt, um den Datenaustausch zwischen API und beispielsweise einer Web-App zu ermöglichen:

```console
$ gcloud functions deploy rkiApi --runtime=nodejs10 --trigger-http --allow-unauthenticated
```

### Lokale Entwicklungsumgebung

Um das Skript `index.js` lokal zu testen, verwendet man am besten das Google Functions Framework. Das Functions Framework kann mit dem Befehl `npm run watch` gestartet werden. Das hat den Vorteil, dass das Skript jedes Mal neu geladen wird, sobald man Änderungen am Code vornimmt.

Man kann das Functions Framework aber auch manuell installieren und ausführen:

```console
$ npm i -g @google-cloud/functions-framework
```

Funktion *rkiApi* starten:

```console
$ functions-framework --target=rkiApi
```

API-Anfrage stellen (Beispiel):

```console
$ curl -X GET 'localhost:8080/query?group=Landkreis&bundesland=Bayern'
```
