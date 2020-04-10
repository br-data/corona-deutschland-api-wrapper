const fetch = require('node-fetch');

const districtsBy = require('./lib/govs-counties-by.json');

const rkiBaseUrl = 'https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?'

exports.rkiApi = async function (req, res) {
  const query = req.query;
  // console.log(query)

  // handle undefined values
  const startDate = query.startDate ? handleDateFormat(query.startDate) : '2020-01-24'; // '2020-01-24' is first that has data
  const endDate = query.endDate ? handleDateFormat(query.endDate) : new Date().toISOString().split('T')[0];
  const geschlecht = query.geschlecht ? query.geschlecht : '';
  const altersgruppe = query.altersgruppe ? query.altersgruppe : '';
  const bundesland = query.bundesland ? query.bundesland : '';
  const landkreis = query.landkreis ? query.landkreis : '';
  const regierungsbezirk = query.regierungsbezirk ? query.regierungsbezirk : '';

  const filterQuery = writeFilterQuery({geschlecht, altersgruppe, bundesland, landkreis});

  const group = query.group ? query.group : '';
  const format = query.format ? query.format : 'json';

  const validKeys = ['startDate', 'endDate', 'geschlecht', 'altersgruppe', 'bundesland', 'landkreis', 'regierungsbezirk', 'group', 'format'];
  if (Object.keys(query).some(key => !validKeys.includes(key))) {
    res.send({error: 'Unknown parameters in URL. Please check spelling. Keys are lower-case, values are upper-case.'});
  }
  if ((regierungsbezirk != '' || group == 'Regierungsbezirk') && bundesland != 'Bayern') {
    res.send({error: 'Bitte wählen Sie "bundesland=Bayern" in der URL!'});
  }

  let data = await (async () => {
    const rkiQuery = group == 'Regierungsbezirk' ?
      writeRkiQuery(endDate, filterQuery, 'Landkreis') :
      writeRkiQuery(endDate, filterQuery, group);

    // call RKI-API
    let response = await fetchJson(rkiQuery)
      .then(res => res.features // parsed json
        .map(d => d.attributes));
    
    if (group == 'Regierungsbezirk') {
      // join by 'Landkreis' => add government district
      response.map(d => {
        d.Regierungsbezirk = districtsBy
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

    return(response);
  })();
  
  data = analyse(data);

  data = postFilter(data);

  function analyse(data) {
    // @param {Array} data
    // @return {Array}

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

    return(data);
  }

  function postFilter(data) {
    // @param {Array} data
    // @return {Array}

    // filter dates before 'startDate'
    data = data.filter(d => d.Meldedatum >= startDate);
    // filter gov district
    if (regierungsbezirk != '') {
      data = data.filter(d => regierungsbezirk.split(',').includes(d.Regierungsbezirk));
    }

    return(data);
  }

  if (format == 'csv') {
    // spread group values to columns
    data.map(d => spreadGroup(d, group));

    // merge same dates in one line
    data = Object.values(groupBy(data, 'Meldedatum')).
      map(arr => arr.reduce((acc, val) => Object.assign(acc, val),[]));      

    data = jsonToCsv(data);
    res.send(data);
  } else {
    res.send(data);
  }
}

async function fetchJson(url) {
  return fetch(encodeURI(url))
    .then(res => res.json())
    .catch(console.error);
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

const groupBy = function(arr, key) {
  // groups array of objects into array of arrays with grouped data
  const group =  arr
    .reduce((acc, val) => {
      (acc[val[key]] = acc[val[key]] || []).push(val);
        return acc;
    }, {});

  return(group);
}

function handleDateFormat(str) {
// adds 0 to 1-digit day or month values
  const year = str.split('-')[0];
  const month = str.split('-')[1].length == 1 ? `0${str.split('-')[1]}` : str.split('-')[1];
  const day = str.split('-')[2].length == 1 ? `0${str.split('-')[2]}` : str.split('-')[2];

  return `${year}-${month}-${day}`;
}

function jsonToCsv(json) {
  const header = Object.keys(Object.assign({}, ...json))
  const rows = json.map(d => header.map(name => d[name]));
  const csv = [header, ...rows]
    .map(d => d.join(','))
    .join('\r\n');
    return(csv);
}

function spreadGroup(obj, group) {
// turns group value into new key: {sumValue: 10, Geschlecht: 'M'} => {M: 10}
  const groupValue = obj[group] || 'all';
  obj[groupValue] = obj.sumValue;
  delete obj[group];
  delete obj.value;
  delete obj.sumValue;
  return(obj);
}

function writeFilterQuery(filter) {
  // remove empty filters
  Object.keys(filter).forEach(key => {if(filter[key] == '') {delete filter[key];}})
  if (Object.keys(filter).length == 0) {
    return('');
  }
  const filterParam = Object.keys(filter);

  filterParam.forEach(key => filter[key] = filter[key].split(','));
  filterParam.forEach(key => filter[key] = filter[key].map(d => `'${d}'`));
  filterParam.forEach(key => filter[key] = filter[key].map(d => `${key[0].toUpperCase()}${key.slice(1)}=${d}`));
  filterParam.forEach(key => filter[key] = filter[key].length > 1 ? filter[key].join('+OR+') : filter[key][0]);
  filterParam.forEach(key => filter[key] = `(${filter[key]})`);
  console.log(filter);

  return(`+AND+` + Object.values(filter).join('+AND+'));
}

function writeRkiQuery(endDate, filterQuery, group) {
  const rkiQuery = `${rkiBaseUrl}` +
    `where=Meldedatum<='${endDate}'` + `${filterQuery}` +
    `&orderByFields=Meldedatum` + 
    `&groupByFieldsForStatistics=Meldedatum${group.length > 0 ? ',' + group : ''}` +
    `&outStatistics=[{"statisticType":"sum","onStatisticField":"AnzahlFall","outStatisticFieldName":"value"}]` +
    `&f=pjson`;

    return(rkiQuery);
}
