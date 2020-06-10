const fetch = require('node-fetch');

module.exports = async function getCurrentCases(params) {
  const casesUrl = getWrapperUrl(params, 'AnzahlFall');
  const deathsUrl = getWrapperUrl(params, 'AnzahlTodesfall');

  async function getData() {
    const dataCases = await fetchJson(casesUrl).catch((error) =>
      handleError(req, res, error)
    );
    const dataDeaths = await fetchJson(deathsUrl).catch((error) =>
      handleError(req, res, error)
    );

    const data = merge(dataCases, dataDeaths);

    function merge(dataCases, dataDeaths) {
      dataCases.map((d) => {
        const deathSum = dataDeaths.find(
          (obj) => obj.date === d.date && obj[params.group] === d[params.group]
        ).sumValue;
        d.deathSum = deathSum;
      });
      return dataCases;
    }

    return data;
  }

  function getWrapperUrl(params, field) {
    const newParams = Object.assign({}, params);
    Object.keys(newParams).forEach(
      (key) => newParams[key] === undefined && delete newParams[key]
    );
    // newParams.currentCases = false;
    delete newParams.currentCases;
    newParams.startDate = '2020-01-01';
    newParams.dateField = 'Refdatum';
    newParams.sumField = field;
    newParams.filetype = 'json';

    const query = new URLSearchParams(newParams).toString();
    const url =
      'https://europe-west3-brdata-corona.cloudfunctions.net/rkiApi/?' + query;

    return url;
  }

  function calculateCurrentCases(data) {
    data.map((d, i) => {
      d.currentlyRecovered = i < 14 ? 0 : data[i - 14].sumValue - d.deathSum;
      d.currentlyInfected = d.sumValue - d.currentlyRecovered - d.deathSum;
    });
    return data;
  }

  function adjustHeavyCases(data, amount) {
    data.map((d, i) => {
      const heavyCases = Math.floor(d.currentlyRecovered * amount);
      d.currentlyRecovered -= heavyCases;
      d.currentlyInfected += heavyCases;

      for (let ii = 0; ii < heavyCases; ii++) {
        const delay = Math.floor(Math.random() * 28) + 1;
        if (i + delay < data.length) {
          data[i + delay].currentlyRecovered += 1;
          data[i + delay].currentlyInfected -= 1;
        }
      }
    });

    return data;
  }

  // Groups array of objects into array of arrays
  function groupBy(arr, key) {
    return arr.reduce((acc, val) => {
      (acc[val[key]] = acc[val[key]] || []).push(val);
      return acc;
    }, {});
  }

  async function fetchJson(url) {
    return fetch(url)
      .then((res) => res.json())
      .catch(console.error);
  }

  const data = getData().then((data) => {
    const groupedData = groupBy(data, params.group);
    const calculatedData = Object.keys(groupedData).reduce((acc, val) => {
      const currentData = calculateCurrentCases(groupedData[val]);
      const adjustedData = adjustHeavyCases(currentData, 0.2);
      acc = acc.concat(adjustedData);

      return acc;
    }, []);
    return calculatedData;
  });
  return data;
};
