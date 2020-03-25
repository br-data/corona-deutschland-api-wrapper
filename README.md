# Corona Deutschland Scraper (RKI)

## Daten

RKI: <https://experience.arcgis.com/experience/478220a4c454480e823b17327b2bf1d4>

## Einzelne Fälle

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?
  f=json&
  where=Meldedatum%3Etimestamp%20%272020-03-01%2022%3A59%3A59%27&
  returnGeometry=false&
  spatialRel=esriSpatialRelIntersects&
  outFields=ObjectId%2CAnzahlFall%2CMeldedatum%2CNeuerFall&
  orderByFields=Meldedatum%20asc&
  resultOffset=12000&
  resultRecordCount=2000&
  cacheHint=true
```

Was bewirkt `resultOffset`?

## Aggregierte Fälle pro Bundesland

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Coronaf%C3%A4lle_in_den_Bundesl%C3%A4ndern/FeatureServer/0/query?
  f=json&
  where=1%3D1&returnGeometry=false&
  spatialRel=esriSpatialRelIntersects&
  outFields=*&
  orderByFields=Fallzahl%20desc&
  outSR=102100&
  resultOffset=0&
  resultRecordCount=25&
  cacheHint=true
```

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Coronaf%C3%A4lle_in_den_Bundesl%C3%A4ndern/FeatureServer/0/query?
  f=json&where=1%3D1&
  returnGeometry=false&
  spatialRel=esriSpatialRelIntersects&
  outFields=*&
  groupByFieldsForStatistics=LAN_ew_GEN&
  orderByFields=value%20desc&
  outStatistics=%5B%7B%22statisticType%22%3A%22max%22%2C%22onStatisticField%22%3A%22faelle_100000_EW%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&
  cacheHint=true
```

Was bewirkt `outStatistics`?

## Fälle nach Altergruppe und Geschlecht (Deutschland)

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?
  f=json&
  where=Geschlecht%3C%3E%27unbekannt%27%20AND%20Altersgruppe%3C%3E%27unbekannt%27&
  returnGeometry=false&
  spatialRel=esriSpatialRelIntersects&
  outFields=*&
  groupByFieldsForStatistics=Altersgruppe%2CGeschlecht&
  orderByFields=Altersgruppe%20asc&
  outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22AnzahlFall%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&
  cacheHint=true
```

Was bewirkt `outStatistics`?

## Fälle pro 100.000 Einwohner (Bundesländer)

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Coronaf%C3%A4lle_in_den_Bundesl%C3%A4ndern/FeatureServer/0/query?f=json&where=1%3D1&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&groupByFieldsForStatistics=LAN_ew_GEN&orderByFields=value%20desc&outStatistics=%5B%7B%22statisticType%22%3A%22max%22%2C%22onStatisticField%22%3A%22faelle_100000_EW%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&cacheHint=true
```

## Aggregiert Anzahl der Infizierten (Deutschland)

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Coronaf%C3%A4lle_in_den_Bundesl%C3%A4ndern/FeatureServer/0/query?f=json&where=1%3D1&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22Fallzahl%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&outSR=102100&cacheHint=true
```

## Aggregierte Anzahl der Neuinfizierten (Deutschland)

(```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?f=json&where=NeuerFall%3D1&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22AnzahlFall%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&cacheHint=true
```)

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?
where=Meldedatum%3C%3D%2703%2F24%2F2020%27&
outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22AnzahlFall%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&having=&
f=pjson
```

Über den Parameter `where` kann nach Datum gefiltert werden. `where=Meldedatum%3C%3D%2703%2F24%2F2020%27` steht für `Meldedatum<='03/24/2020'` - also alle Fälle bis einschließlich 24.03.2020.  

Über den Parameter `outStatistics` kann man die Fälle summieren.

Außerdem kann man hier nach Bundesland, Landkreis, Geschlecht, etc. filtern oder aggregieren.

Siehe [API Explorer](https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?where=Meldedatum%3C%3D%2703%2F24%2F2020%27&objectIds=&time=&resultType=standard&outFields=*&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22AnzahlFall%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=html),
[Metadaten](https://services7.arcgis.com/mOBPykOjAyBO2ZKk/ArcGIS/rest/services/RKI_COVID19/FeatureServer/0)

![](img/api_explorer.png)

## Aggregierte Anzahl der Todesfälle (Deutschland)

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/Coronaf%C3%A4lle_in_den_Bundesl%C3%A4ndern/FeatureServer/0/query?f=json&where=1%3D1&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22Death%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&cacheHint=true
```

## Aggregierte Anzahl der neuen Todesfälle (Deutschland)

```text
https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?f=json&where=NeuerTodesfall%3D1&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22AnzahlTodesfall%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&cacheHint=true
```
