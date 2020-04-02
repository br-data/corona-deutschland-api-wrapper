import fetch from 'node-fetch';

const rkiBaseUrl = "https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?"
// const query = "https://europe-west3-brdata-niels.cloudfunctions.net/rkiCovid19Api/query?startDate=2020-01-24&endDate=2020-01-28&group=Geschlecht";


export async function rkiCovid19Api(req, res) {
  const query = req.query;
  // handle undefined values
  const startDate = query.startDate ? query.startDate : "";
  const endDate = query.endDate ? query.endDate : "";
  const group = query.group ? query.group : "";
  
  const dateRange = getDateRange(startDate, endDate);
  const rkiQueries = dateRange.
    map(d => writeRkiQuery(d, group));
  const responses = await Promise.all(rkiQueries
    .map(fetchJson))
  const data = responses
    // parse nested json
    .map(d => d.features)
    .map((d) => d.map(d => d.attributes))
    // combine return values with dates
    .map((d, i) => d.map(dd => Object.assign({date: dateRange[i]}, dd)))
    .flat();
        
    res.send(jsonToCsv(data));
}

function jsonToCsv(json) {
  const header = Object.keys(json[0]);
  const rows = json.map(d => header.map(name => d[name]));
  const csv = [header, ...rows]
    .map(d => d.join(','))
    .join('\r\n');
  
    console.log(csv);
  return(csv);
}

function getDateRange(startDate, endDate) {
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  const msPerDay = 1000 * 3600 * 24;
  const nDays = (endTime - startTime) / msPerDay + 1;
  const dateRange = Array(nDays)
    .fill(startDate)
    .map((d, i) => {
      const date = new Date(d);
      // add i day(s) to date
      date.setDate(date.getDate() + i)
      return(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`)
    })

  return(dateRange)
}

function writeRkiQuery(endDate, group) {
  const rkiQuerySting = `${rkiBaseUrl}` +
    `where=Meldedatum<='${endDate}'` +
    `&groupByFieldsForStatistics=${group}` +
    `&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlFall","outStatisticFieldName":"value"}]` +
    `&f=pjson`;
  return(rkiQuerySting)
}

async function fetchJson(url) {
  return fetch(url)
    .then(res => res.json())
    .catch(console.error);
}

function handleResponse(req, res, result) {
  const isCsv = req.query.filetype === 'csv';
  const contentType = isCsv ? 'text/csv' : 'application/json';
  const response = isCsv ? jsonToCsv(result) : result;

  res.set('Content-Type', contentType);
  res.send(response);
}
