const fs = require('fs');

// curl "https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?where=Bundesland%3D%27Bayern%27&orderByFields=IdLandkreis&groupByFieldsForStatistics=Landkreis%2C+IdLandkreis&outStatistics=%5B%7B%22statisticType%22%3A%22sum%22%2C%22onStatisticField%22%3A%22AnzahlFall%22%2C%22outStatisticFieldName%22%3A%22value%22%7D%5D&f=pjson" | jq '[. | {features: .features[].attributes} | {landkreis: .features.Landkreis, id: .features.IdLandkreis}]'
const counties = require('./counties-by.json');
// https://www.statistikdaten.bayern.de/genesis/online/data?operation=ergebnistabelleUmfang&levelindex=2&levelid=1586256237689&downloadname=12411-001
// manuell erfasst
const government = require('./gov-districts-by.json');

counties.map(d => {
  d.regBez = government.find(regBez => regBez.id == d.id.substring(0, 3)).regBez;
})

fs.writeFileSync('./govs-counties-by.json', JSON.stringify(counties), 'utf-8');
