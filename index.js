const fetch = require('node-fetch');

const jsonToCsv = require('./lib/json-to-csv');
const counties = require('./data/counties.json');

const rkiBaseUrl = 'https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?';

const params = {
  startDate: undefined,
  endDate: undefined,
  sumField: undefined,
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
  const validParams = ['startDate', 'endDate', 'sumField', 'geschlecht', 'altersgruppe', 'bundesland', 'landkreis', 'regierungsbezirk', 'group', 'filetype'];
  const invalidParams = Object.keys(query).filter(key => !validParams.includes(key));

  // Handle unknown parameters
  if (invalidParams.length) {
    handleError(req, res, {
      error: `Invalid query: Unknown parameters ${invalidParams.join(', ')}. Keys are lower-case, values are upper-case.`
    });
  } else {
    // Handle missing aggregation parameter
    if ((query.regierungsbezirk || query.group === 'Regierungsbezirk') &&
      query.bundesland !== 'Bayern') {
      handleError(req, res, {
        error: 'Invalid query: Please set "bundesland=Bayern" when using "group=Regierungsbezirk"'
      });
    } else {
      handleQuery(req, res);
    }
  }
};

async function handleQuery(req, res) {
  // Set query parameters
  Object.keys(params).forEach(key => {
    params[key] = req.query[key] || undefined;
  });
  // Set start and end date
  // Note: '2020-01-24' is first possible date
  params.startDate = req.query.startDate ? toDateString(req.query.startDate) : '2020-01-24';
  params.endDate = req.query.endDate ? toDateString(req.query.endDate) : toDateString(new Date());
  
  params.group = req.query.group || '';
  params.sumField = req.query.sumField || 'AnzahlFall';
  
  const filterQuery = getFilterQuery(['geschlecht', 'altersgruppe', 'bundesland', 'landkreis']);
  const rawData = await getData(filterQuery);

  if (rawData && rawData.length) {
    const analysedData = aggregateData(rawData);
    const filteredData = filterData(analysedData);

    handleResponse(req, res, filteredData);
  } else {
    handleError(req, res, {
      error: 'Query failed: No data received. Please check your query parameter values.'
    });
  }
}

function handleResponse(req, res, data) {
  // Set CORS header to allow all origins
  res.set('Access-Control-Allow-Origin', '*');

  if (params.filetype === 'csv') {
    // Spread group values to columns
    const spreadedData = data.map(d => spreadGroup(d, params.group));
    // Merge same dates in one line
    const mergedData = Object.values(groupBy(spreadedData, 'Meldedatum'))
      .map(arr => arr.reduce((acc, val) => Object.assign(acc, val), []));

    res.send(jsonToCsv(mergedData));
  } else {
    res.send(data);
  }
}

function handleError(req, res, error) {
  // Set CORS header to allow all origins
  res.set('Access-Control-Allow-Origin', '*');

  if (params.filetype === 'csv') {
    res.send(error.error || error);
  } else {
    res.send(error);
  }
}

async function getData(filterQuery) {
  if (params.group === 'Regierungsbezirk') {
    const query = getRkiQuery(filterQuery, 'Landkreis');
    const data = await fetchJson(query)
      .then(json => json.features.map(d => d.attributes))
      .catch(error => console.error(error));
    return mergeData(data);
  } else {
    const query = getRkiQuery(filterQuery, params.group);
    const data = await fetchJson(query)
      .then(json => json.features.map(d => d.attributes))
      .catch(error => console.error(error));
    return data;
  }
}

// Join by 'Landkreis', add government district
function mergeData(data) {
  const enrichedData = data.map(d => {
    const currentData = Object.assign(d, {
      Regierungsbezirk: counties
        .find(dd => dd.landkreis == d.Landkreis).regBez
    });
    delete currentData.Landkreis;
    return currentData;
  });

  const mergedData = Object.values(groupBy(enrichedData, 'Regierungsbezirk'))
    .map(arrDistrict => Object.values(groupBy(arrDistrict, 'Meldedatum'))
      .map(arrDate => arrDate
        .reduce((acc, val) => Object.assign(acc, {value: acc.value + val.value}))
      )
    )
    .reduce((acc, val) => acc.concat(val), []);

  return mergedData;
}

function aggregateData(data) {
  // Group data before summarize cumulative
  const groupedData = groupBy(data, params.group);
  
  const aggregatedData = Object.keys(groupedData).reduce((result, key) => {
    let currentData = groupedData[key];

    // Sort grouped object by date
    currentData = currentData.sort((a, b) => a.Meldedatum - b.Meldedatum);
    // Fill missing dates per group
    currentData = fillMissingDates(currentData);
    // Change date format from integer to string
    currentData = currentData.map(d =>
      Object.assign(d, {
        Meldedatum: toDateString(d.Meldedatum)
      })
    );
    console.log(currentData);
    // Sum values cumulative per group
    let currentValue = 0;
    currentData.map(d => d.sumValue = currentValue += d.value);

    result.push(currentData);
    return result;
  }, []);

  // Flatten data object by removing group key
  const flatData = Object.values(aggregatedData).reduce((acc, val) => acc.concat(val), []);

  return flatData;
}

function filterData(data) {
  // Filter dates before 'startDate'
  const filteredData = data.filter(d => d.Meldedatum >= params.startDate);

  // Filter gov district
  if (params.regierungsbezirk) {
    return filteredData.filter(d => params.regierungsbezirk.split(',').includes(d.Regierungsbezirk));
  } else {
    return filteredData;
  }
}

function fillMissingDates(arr) {
  let nextDay = arr[0].Meldedatum;
  return arr.reduce((acc, val) => {
    // Ignore daylight saving time
    while (val.Meldedatum - nextDay > 0) {
      const missingDate = Object.assign({...val}, {value: 0, Meldedatum: nextDay});
      acc.push(missingDate);
      nextDay += 1000 * 3600 * 24;
    }
    nextDay += 1000 * 3600 * 24;
    return acc.concat(val);
  }, []);
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
      query = query + queryPart;
    }
    return query;
  }, '');
}

// Build full query string for RKI API
function getRkiQuery(filterQuery, group) {
  return `${rkiBaseUrl}` +
    `where=Meldedatum<='${params.endDate}'` + `${filterQuery}` +
    '&orderByFields=Meldedatum' +
    `&groupByFieldsForStatistics=Meldedatum${group.length > 0 ? ',' + group : ''}` +
    `&outStatistics=[{"statisticType":"sum","onStatisticField":"${params.sumField}",` + `"outStatisticFieldName":"value"}]` +
    '&f=pjson';
}

// Groups array of objects into array of arrays
function groupBy(arr, key) {
  return arr.reduce((acc, val) => {
    (acc[val[key]] = acc[val[key]] || []).push(val);
    return acc;
  }, {});
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

// Get JSON from URL
async function fetchJson(url) {
  return fetch(encodeURI(url))
    .then(res => res.json())
    .catch(console.error);
}
