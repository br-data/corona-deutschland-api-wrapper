# Corona Deutschland Scraper (RKI)

## Daten

RKI: <https://experience.arcgis.com/experience/478220a4c454480e823b17327b2bf1d4>

Eine detaillierte Beschreibung der RKI-API findet sich in [RKI-API.md](./RKI-API.md):

## Verwendung

Diese Anleitung geht davon aus, dass du bereits ein Google Cloud-Konto und ein Rechnungskonto dafür eingericht hast. Außerdem solltest du das Google Cloud-Kommandzeilenwerkzeug [installiert](https://cloud.google.com/sdk/install) und mit deinem Benutzerkonto [verknüpft](https://cloud.google.com/sdk/docs/initializing) haben.

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

Rechenzentrum *europe-west3* (Frankfurt) als Ziel für das Funktions-Deployment festlegen. Das gewählte Rechenzentrum muss identisch sein, mit dem Rechenzentrum für die Firestore-Datenbank:

```console
$ gcloud config set functions/region europe-west3
```

API-Funktion deployen: In diesem Beispiel wird der nicht authentifizierte Zugriff von außerhalb erlaubt, um den Datenaustausch zwischen API und beispielsweise einer Web-App zu ermöglichen:

```console
$ gcloud functions deploy rkiApi --runtime nodejs10 --trigger-http --allow-unauthenticated
```

### Lokale Entwicklungsumgebung

Das Google Functions Framework global installieren, um Funktion lokal testen zu können:

```console
$ npm i -g @google-cloud/functions-framework
```

Funktion *rkiApi* starten:

```console
$ functions-framework --target=rkiApi
```

API-Anfrage an die aktivierte Funktion stellen (Beispiel):

```console
$ curl -X GET 'localhost:8080?germany/cases?filetype=csv'
```
