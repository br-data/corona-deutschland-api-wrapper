const fetch = require('node-fetch');

const jsonToCsv = require('./lib/json-to-csv');
const getCurrentCases = require('./lib/get-current-cases');
const counties = require('./data/counties.json');

const rkiBaseUrl = 'https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?';

const params = {
  startDate: undefined,
  endDate: undefined,
  dateField: undefined,
  sumField: undefined,
  geschlecht: undefined,
  altersgruppe: undefined,
  altersgruppe2: undefined,
  bundesland: undefined,
  landkreis: undefined,
  regierungsbezirk: undefined,
  group: undefined,
  sumValue: undefined,
  newCases: undefined,
  currentCases: undefined,
  filetype: undefined
};

exports.rkiApi = async function (req, res) {
  // Handle CORS
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  } else {
    const query = req.query;
    const validParams = ['startDate', 'endDate', 'dateField', 'sumField', 'geschlecht', 'altersgruppe', 'altersgruppe2', 'bundesland', 'landkreis', 'regierungsbezirk', 'group', 'sumValue', 'newCases', 'currentCases', 'filetype'];
    const invalidParams = Object.keys(query).filter(key => !validParams.includes(key));

    // Handle unknown parameters
    if (invalidParams.length) {
      handleError(req, res, {
        error: `Invalid query: Unknown parameter ${invalidParams.join(', ')}. Keys are lower-case, values are upper-case.`
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
  }
};

async function handleQuery(req, res) {
  // Set query parameters
  Object.keys(params).forEach(key => {
    params[key] = req.query[key] || undefined;
  });
  // Set start and end date
  // Note: '2020-01-24' is first possible report date
  params.startDate = req.query.startDate ? toDateString(req.query.startDate) : '2020-01-24';
  params.endDate = req.query.endDate ? toDateString(req.query.endDate) : toDateString(new Date());
  
  params.group = req.query.group || '';
  params.dateField = req.query.dateField || 'Meldedatum';
  params.sumField = req.query.sumField || 'AnzahlFall';
  params.sumValue = req.query.sumValue ? req.query.sumValue === 'true' : true;
  params.newCases = req.query.newCases === 'true' ? params.sumField
    .replace('AnzahlFall', 'NeuerFall')
    .replace('AnzahlTodesfall', 'NeuerTodesfall')
    .replace('AnzahlGenesen', 'NeuGenesen') : false;

  const filterQuery = getFilterQuery(['geschlecht', 'altersgruppe', 'altersgruppe2', 'bundesland', 'landkreis']);

  const rawData = await getData(req, res, filterQuery);
  const rawDataNewCases = params.newCases ? await getData(req, res, filterQuery, true) : undefined;

  if (rawData && rawData.length) {
    const analysedData = aggregateData(rawData);
    const filteredData = filterData(analysedData);
    
    if (rawDataNewCases && rawDataNewCases.length) {
      const analysedDataNewCases = aggregateData(rawDataNewCases);
      const filteredDataNewCases = filterData(analysedDataNewCases);
      // @Todo Make this immutable
      filteredData.map(d => {
        let newCases = filteredDataNewCases
          .find(obj => (obj.date === d.date && obj[params.group] === d[params.group]));
        d.newCases = newCases ? newCases.value : 0;
        d.sumNewCases = newCases ? newCases.sumValue : 0;
      });
    }

    if (params.currentCases === 'true') {
      const currentCases = await getCurrentCases(params);
      // @Todo Make this immutable
      filteredData.map(d => {
        const current = currentCases
          .find(obj => (obj.date === d.date && obj[params.group] === d[params.group]));
        d.currentlyInfected = current.currentlyInfected;
        d.currentlyRecovered = current.currentlyRecovered;
        d.deathSum = current.deathSum;
      });
    }

    handleResponse(req, res, filteredData);
  } else {
    handleError(req, res, {
      error: 'Query failed: No data received'
    });
  }
}

function handleResponse(req, res, data) {
  if (params.filetype === 'csv') {
    // Spread group values to columns
    const spreadedData = data.map(d => spreadGroup(d, params.group));
    // Merge same dates in one line
    const mergedData = Object.values(groupBy(spreadedData, 'date'))
      .map(arr => arr.reduce((acc, val) => Object.assign({}, acc, val), []));

    res.send(jsonToCsv(mergedData));
  } else {
    res.send(data);
  }
}

function handleError(req, res, error) {
  const errorMessage = error.error || error.message || error;
  const errorString = `${error.name ? (error.name + ': ') : ''}${errorMessage}`;

  if (params.filetype === 'csv') {
    res.send(errorString);
  } else {
    res.send({ error: errorString});
  }
}

async function getData(req, res, filterQuery, getNewCases = false) {
  if (params.group === 'Regierungsbezirk') {
    const query = getRkiQuery(filterQuery, 'Landkreis', getNewCases);
    const data = await fetchJson(query)
      .then(json => json.features.map(d => d.attributes))
      .catch(error => handleError(req, res, error));
    return mergeData(data);
  } else {
    const query = getRkiQuery(filterQuery, params.group, getNewCases);
    const data = await fetchJson(query)
      .then(json => json.features.map(d => d.attributes))
      .catch(error => handleError(req, res, error));
    return data;
  }
}

// Join by 'Landkreis', add government district
function mergeData(data) {
  const enrichedData = data.map(d => {
    const currentData = Object.assign({}, d, {
      Regierungsbezirk: counties
        .find(dd => dd.landkreis == d.Landkreis).regBez
    });
    delete currentData.Landkreis;
    return currentData;
  });

  const mergedData = Object.values(groupBy(enrichedData, 'Regierungsbezirk'))
    .map(arrDistrict => Object.values(groupBy(arrDistrict, params.dateField))
      .map(arrDate => arrDate
        .reduce((acc, val) => Object.assign({}, acc, {value: acc.value + val.value}))
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
    currentData = currentData.sort((a, b) => a[params.dateField] - b[params.dateField]);
    // Fill missing dates per group
    currentData = fillMissingDates(currentData);
    // Change date format from integer to string
    currentData = currentData.map(d => {
      const newDate = Object.assign(d, {
        date: toDateString(d[params.dateField])
      });
      delete d[params.dateField];
      return newDate;
    });
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
  const filteredData = data.filter(d => d.date >= params.startDate);

  // Filter gov district
  if (params.regierungsbezirk) {
    return filteredData.filter(d => params.regierungsbezirk.split(',').includes(d.Regierungsbezirk));
  } else {
    return filteredData;
  }
}

function fillMissingDates(arr) {

  if (arr[0][params.dateField] > new Date('2020-01-24').getTime()) {
    arr.unshift(Object.assign({}, arr[0], {value: 0, [params.dateField]: new Date('2020-01-24').getTime()}));
  }
  if (arr[arr.length - 1][params.dateField] < new Date(params.endDate).getTime() - 1000 * 3600 * 24) {
    arr.push(Object.assign({}, arr[arr.length - 1], {value: 0, [params.dateField]: new Date(params.endDate).getTime() - 1000 * 3600 * 24}));
  }

  // == First possible date
  let nextDay = arr[0][params.dateField];

  arr = arr.reduce((acc, val) => {
    // Ignore daylight saving time
    while (val[params.dateField] > nextDay) {
      const missingDate = Object.assign({...val}, {value: 0, [params.dateField]: nextDay});
      acc.push(missingDate);
      nextDay += 1000 * 3600 * 24;
    }
    nextDay += 1000 * 3600 * 24;
    return acc.concat(val);
  }, []);
  
  return arr;
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
function getRkiQuery(filterQuery, group, getNewCases = false) {
  return `${rkiBaseUrl}` +
    `where=${params.dateField}<='${params.endDate}'+AND+${params.dateField}>='${params.startDate}'` + `${filterQuery}` +
    `${getNewCases ? '+AND+(' + params.newCases + '=-1+OR+' + params.newCases + '=1)' : ''}` +
    '&resultType=standard' +
    `&orderByFields=${params.dateField}` +
    `&groupByFieldsForStatistics=${params.dateField}${group.length > 0 ? ',' + group : ''}` +
    `&outStatistics=[{"statisticType":"sum","onStatisticField":"${params.sumField}",` + '"outStatisticFieldName":"value"}]' +
    '&sqlFormat=standard' +
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

  obj[groupValue] = params.sumValue ? obj.sumValue : obj.value;
  
  const output = ['date', groupValue].reduce((output, key) => {
    output[key] = obj[key];
    return output; }, {});

  return output;
}

function fixAgeGroup(url) {
  return url
    // Handle age-group 'A80+'
    .replace('A80%20', 'A80%2B');
}

// Get JSON from URL
async function fetchJson(url) {
  const encodedUrl = encodeURI(url);
  const handledUrl = fixAgeGroup(encodedUrl);
  return fetch(handledUrl)
    .then(res => res.json())
    .catch(console.error);
}
