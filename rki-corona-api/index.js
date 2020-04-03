const fetch = require('node-fetch');

const rkiBaseUrl = "https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?"

exports.rkiApi = async function (req, res) {
  const query = req.query;
  // handle undefined values
  const startDate = query.startDate ? handleDateFormat(query.startDate) : "2020-01-24"; // "2020-01-24" is first that has data
  const endDate = query.endDate ? handleDateFormat(query.endDate) : handleDateFormat(`${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`);
  const group = query.group ? query.group : "";
  const format = query.format ? query.format : "json";
  const filter = query.filter ? query.filter : "";  
  const dateRange = getDateRange(startDate, endDate);
  const rkiQueries = dateRange.
    map(d => writeRkiQuery(d, filter, group));
  const responses = await Promise.all(rkiQueries
    .map(fetchJson))
  const data = responses
    // parse nested json
    .map(d => d.features)
    .map((d) => d.map(d => d.attributes))
    // combine return values with dates
    .map((d, i) => d.map(dd => Object.assign({date: dateRange[i]}, dd)))
    // = flat()
    .reduce((acc, val) => acc.concat(val), []);

  if (format == "csv") {
    // this messes up the "data" array :(
    const spreadData = data.
      map(d => spreadGroup(d, group));
    const groupedData = groupBy(spreadData, "date").
      map(arr => arr.reduce((acc, val) => Object.assign(acc, val)));
    const response = jsonToCsv(groupedData);
    res.send(response);
  } else {
    const response = data;
    res.send(response);
  }
}


function handleDateFormat(str) {
// adds 0 to 1-digit day or month values
  const year = str.split('-')[0];
  const month = str.split('-')[1].length == 1 ? `0${str.split('-')[1]}` : str.split('-')[1];
  const day = str.split('-')[2].length == 1 ? `0${str.split('-')[2]}` : str.split('-')[2];

  return `${year}-${month}-${day}`;
}

function spreadGroup(obj, group) {
// turns group value into new key: {value: 10, Geschlecht: "M"} => {M: 10}
  const groupValue = obj[group];
  obj[groupValue] = obj.value;
  delete obj[group];
  delete obj.value;
  return obj;
}

const groupBy = function(arr, key) {
// groups array of objects into array of arrays with grouped data
  const groupedObject = arr
    .reduce((acc, val) => {
      (acc[val[key]] = acc[val[key]] || []).push(val);
        return acc;
    }, {})
  return Object.values(groupedObject);
  }

function jsonToCsv(json) {
  const header = Object.keys(Object.assign({}, ...json));
  const rows = json.map(d => header.map(name => d[name]));
  const csv = [header, ...rows]
    .map(d => d.join(','))
    .join('\r\n');
    return csv;
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

function writeRkiQuery(endDate, filter, group) {
  let filterString = "";
  if (filter.length > 0) {
    if(Array.isArray(filter)) {
      filterString = filter.
        reduce((acc, val) => acc + `+OR+${val.split(':')[0]}=${val.split(':')[1]}`, '')
        // remove first '+OR+'
        .substring(4);
      filterString = `+AND+(${filterString})`;
    } else {
      // single filter comes as string
      filterString = `+AND+${filter.split(':')[0]}=${filter.split(':')[1]}`
    }
  } 
  const rkiQuerySting = `${rkiBaseUrl}` +
    `where=Meldedatum<='${endDate}'` + `${filterString}` +
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
