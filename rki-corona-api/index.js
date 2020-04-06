const fetch = require('node-fetch');

const rkiBaseUrl = "https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?"

exports.rkiApi = async function (req, res) {
  const query = req.query;
  // console.log(query);
  // handle undefined values
  const startDate = query.startDate ? handleDateFormat(query.startDate) : "2020-01-24"; // "2020-01-24" is first that has data
  const endDate = query.endDate ? handleDateFormat(query.endDate) : new Date().toISOString().split('T')[0];
  const group = query.group ? query.group : "";
  const format = query.format ? query.format : "json";
  const filter = query.filter ? query.filter : "";  

  const rkiQuery = writeRkiQuery(endDate, filter, group);
  const responses = await fetchJson(rkiQuery);

  let data = responses.features // parse json
    .map(d => d.attributes);
 
  // group data before summarize cumulative
  data = groupBy(data, group);

  // sort grouped object by date
  Object.keys(data).forEach(key => data[key] = data[key].sort((a, b) => a.Meldedatum - b.Meldedatum));

  // fill missing dates per group
  Object.keys(data).forEach(key => data[key] = fillMissingDates(data[key]));

  // change date format from integer to string
  Object.keys(data).forEach(key => data[key] = data[key].map(d => {d.Meldedatum = new Date(d.Meldedatum).toISOString().split('T')[0]; return(d);}));

  // sum values cumulative per group
  Object.keys(data).forEach(key => {
    let currentValue = 0;
    data[key].map(d => d.sumValue = currentValue += d.value);
  });

  // flatten data object by removing group key
  data = Object.values(data).reduce((acc, val) => acc.concat(val), []);

  if (format == "csv") {
    // spread group values to columns
    data.map(d => spreadGroup(d, group));

    // merge same dates in one line
    data = Object.values(groupBy(data, 'Meldedatum')).
      map(arr => arr.reduce((acc, val) => Object.assign(acc, val),[]));      

    const response = jsonToCsv(data);
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

function fillMissingDates(arr) {
  const nextDay = new Date(arr[0].Meldedatum);
  return arr.reduce((acc, val) => {
    while(new Date(val.Meldedatum) - nextDay > 2 * 3600 * 1000) {
      const missingDate = Object.assign({...val}, {value: 0, Meldedatum: nextDay.getTime()});
      acc.push(missingDate)
      nextDay.setDate(nextDay.getDate() + 1);
    }
    nextDay.setDate(nextDay.getDate() + 1);
    return(acc.concat(val));
  }, [])
}

function spreadGroup(obj, group) {
// turns group value into new key: {sumValue: 10, Geschlecht: "M"} => {M: 10}
  const groupValue = obj[group] || 'all';
  obj[groupValue] = obj.sumValue;
  delete obj[group];
  delete obj.value;
  delete obj.sumValue;
  return(obj);
}

const groupBy = function(arr, key) {
// groups array of objects into array of arrays with grouped data
  const group =  arr
    .reduce((acc, val) => {
      (acc[val[key]] = acc[val[key]] || []).push(val);
        return acc;
    }, {});
  
  if(group.hasOwnProperty('undefined')) {
    group.all = group.undefined;
    delete group.undefined;
  }

  return(group);
}

function jsonToCsv(json) {
  const header = Object.keys(Object.assign({}, ...json))
  const rows = json.map(d => header.map(name => d[name]));
  const csv = [header, ...rows]
    .map(d => d.join(','))
    .join('\r\n');
    return csv;
}

function writeRkiQuery(endDate, filter, group) {
  const filterString = writeFilterString(filter);
  const rkiQuerySting = `${rkiBaseUrl}` +
    `where=Meldedatum<='${endDate}'` + `${filterString}` +
    `&orderByFields=Meldedatum` + 
    `&groupByFieldsForStatistics=Meldedatum${group.length > 0 ? ',' + group : ''}` +
    `&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlFall","outStatisticFieldName":"value"}]` +
    `&f=pjson`;

    return(rkiQuerySting)
}

function writeFilterString(filter) {
  let filterString = "";
  if (filter.length > 0) {
    // handle multiple filters
    if(Array.isArray(filter)) {
      filterString = filter.
        reduce((acc, val) => acc + `+OR+${val.split(':')[0]}=${val.split(':')[1]}`, '')
        // remove first '+OR+'
        .substring(4);
      filterString = `+AND+(${filterString})`;
      // handle single filter
    } else {
      // single filter comes as string
      filterString = `+AND+${filter.split(':')[0]}=${filter.split(':')[1]}`
    }
  }
  return(filterString);
}

async function fetchJson(url) {
  return fetch(url)
    .then(res => res.json())
    .catch(console.error);
}
