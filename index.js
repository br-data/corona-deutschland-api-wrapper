const fetch = require('node-fetch');

const jsonToCsv = require('./lib/json-to-csv');
const counties = require('./data/counties.json');

const rkiBaseUrl = 'https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?'

const params = {
  startDate: undefined,
  endDate: undefined,
  geschlecht: undefined,
  altersgruppe: undefined,
  bundesland: undefined,
  landkreis: undefined,
  regierungsbezirk: undefined,
  group: undefined,
  filetype: undefined
};

exports.rkiApi = async function (req, res) {
  const query = req.query;
  const validParams = ['startDate', 'endDate', 'geschlecht', 'altersgruppe', 'bundesland', 'landkreis', 'regierungsbezirk', 'group', 'filetype'];
  const invalidParams = Object.keys(query).filter(key => !validParams.includes(key));

  // Handle unknown parameters
  if (invalidParams.length) {
    res.send({error: `Query failed: Unknown parameters ${invalidParams.join(', ')}. Keys are lower-case, values are upper-case.`});
  } else {
    // Handle missing aggregation parameter
    if ((query.regierungsbezirk || query.group == 'Regierungsbezirk') &&
      query.bundesland != 'Bayern') {
      res.send({error: 'Query failed: Please set "bundesland=Bayern" when using "group=Regierungsbezirk"'});
    } else {
      handleQuery(req, res)
    }
  }
}

async function handleQuery(req, res) {
  // Set query parameters
  Object.keys(params).forEach(key => {
    params[key] = req.query[key] || undefined;
  })

  // Set start and end date
  // Note: '2020-01-24' is first possible date
  params.startDate = req.query.startDate ? toDateString(req.query.startDate) : '2020-01-24';
  params.endDate = req.query.endDate ? toDateString(req.query.endDate) : toDateString(new Date());

  const filterQuery = getFilterQuery(['geschlecht', 'altersgruppe', 'bundesland', 'landkreis']);

  const rawData = await getData(filterQuery, params.group, params.endDate);
  const analysedData = analyseData(rawData, params.group);
  const filteredData = filterData(analysedData, params.regierungsbezirk, params.startDate);

  handleResponse(req, res, filteredData);
}

async function getData(filterQuery) {
  const rkiQuery = (params.group === 'Regierungsbezirk') ?
    getRkiQuery(filterQuery, 'Landkreis') :
    getRkiQuery(filterQuery, params.group);

  // Call RKI-API
  let response = await fetchJson(rkiQuery)
    .then(res => res.features.map(d => d.attributes));
  
  if (params.group == 'Regierungsbezirk') {
    // Join by 'Landkreis' => add government district
    response.map(d => {
      d.Regierungsbezirk = counties
        .find(dd => dd.landkreis == d.Landkreis).regBez;
    });
    response.map(d => { delete d.Landkreis });
    response = Object.values(groupBy(response, 'Regierungsbezirk'))
      .map(arrDistrict => Object.values(groupBy(arrDistrict, 'Meldedatum'))
        .map(arrDate => arrDate
          .reduce((acc, val) => Object.assign(acc, {value: acc.value + val.value}))
        ))
      .reduce((acc, val) => acc.concat(val), []);
  }

  return response;
}

function handleResponse(req, res, data, filetype) {
  // Set CORS header to allow all origins
  res.set('Access-Control-Allow-Origin', '*');

  if (filetype == 'csv') {
    // Spread group values to columns
    const spreadedData = data.map(d => spreadGroup(d, group));

    // Merge same dates in one line
    const mergedData = Object.values(groupBy(spreadedData, 'Meldedatum')).
      map(arr => arr.reduce((acc, val) => Object.assign(acc, val),[]));

    res.send(jsonToCsv(mergedData));
  } else {
    res.send(data);
  }
}

function analyseData(data, group) {
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

  return data;
}

function filterData(data, regierungsbezirk, startDate) {
  // filter dates before 'startDate'
  data = data.filter(d => d.Meldedatum >= startDate);
  // filter gov district
  if (regierungsbezirk != '') {
    data = data.filter(d => regierungsbezirk.split(',').includes(d.Regierungsbezirk));
  }

  return data;
}

function fillMissingDates(arr) {
  const nextDay = new Date(arr[0].Meldedatum);
  return arr.reduce((acc, val) => {
    while (new Date(val.Meldedatum) - nextDay > 2 * 3600 * 1000) {
      const missingDate = Object.assign({...val}, {value: 0, Meldedatum: nextDay.getTime()});
      acc.push(missingDate)
      nextDay.setDate(nextDay.getDate() + 1);
    }
    nextDay.setDate(nextDay.getDate() + 1);
    return acc.concat(val);
  }, [])
}

// Groups array of objects into array of arrays
function groupBy(arr, key) {
  const group = arr.reduce((acc, val) => {
    (acc[val[key]] = acc[val[key]] || []).push(val);
    return acc;
  }, {});

  return group;
}

function toDateString(date) {
  const dateObject = new Date(date);
  return dateObject.toISOString().split('T')[0];
}

// Turns group value into new key
// Example: {sumValue: 10, Geschlecht: 'M'} => {M: 10}
function spreadGroup(obj, group) {
  const groupValue = obj[group] || 'all';

  obj[groupValue] = obj.sumValue;

  delete obj[group];
  delete obj.value;
  delete obj.sumValue;

  return obj;
}

// Build SQL-like filter query string for RKI API
// Example: +AND+(Geschlecht='M')+AND+(Altersgruppe='A35-A59'+OR+Altersgruppe='A15-A34')
function getFilterQuery(filterParams) {
  return filterParams.reduce((query, key) => {
    if (params[key]) {
      let queryPart = params[key]
        .split(',')
        .map(d => `'${d}'`)
        .map(d => `${key[0].toUpperCase()}${key.slice(1)}=${d}`);
      queryPart = (queryPart.length > 1) ? queryPart.join('+OR+') : queryPart[0];
      queryPart = `+AND+(${queryPart})`;
      query = query + queryPart
    }
    return query;
  }, '');
}

// Build full query string for RKI API
function getRkiQuery(filterQuery, group) {
  return `${rkiBaseUrl}` +
    `where=Meldedatum<='${params.endDate}'` + `${filterQuery}` +
    `&orderByFields=Meldedatum` + 
    `&groupByFieldsForStatistics=Meldedatum${group.length > 0 ? ',' + group : ''}` +
    `&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlFall","outStatisticFieldName":"value"}]` +
    `&f=pjson`;
}

// Get JSON from URL
async function fetchJson(url) {
  return fetch(encodeURI(url))
    .then(res => res.json())
    .catch(console.error);
}
