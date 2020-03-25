const fetch = require('node-fetch');

const url ='https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?f=json&where=Meldedatum%3Etimestamp%20%272020-03-01%2022%3A59%3A59%27&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=ObjectId%2CAnzahlFall%2CMeldedatum%2CNeuerFall&orderByFields=Meldedatum%20asc&resultOffset=14000&resultRecordCount=2000&cacheHint=true';

(async function init() {
  const reportedCases = await scrapeBody(url);

  console.log(reportedCases);
})();

async function scrapeBody(url) {
  return fetch(url)
    .then(res => res.text())
    .catch(console.error);
}
