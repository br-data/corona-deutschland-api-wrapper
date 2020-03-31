const fetch = require('node-fetch');
const jsonToCsv = require('./lib/json-to-csv')

const url ='https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Historic_adm0_v3/FeatureServer/0/query?f=json&where=1%3D1&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=OBJECTID%2CNewCase%2CDateOfDataEntry&orderByFields=DateOfDataEntry%20asc&resultOffset=0&resultRecordCount=2000&cacheHint=true';

// req and res are Express objects, see https://expressjs.com/de/api.html
exports.rkiScraper = async (req, res) => {
  const dataJson = await getJson(url);
  const reportedCases = dataJson.features;
  console.log(reportedCases.length);
};

async function getJson(url) {
  return fetch(url)
    .then(res => res.json())
    .catch(console.error);
}
