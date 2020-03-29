module.exports = function jsonToCsv(data) {

  const flattenObject = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, curr) => {
      const pre = prefix.length ? prefix + '.' : '';

      if (typeof obj[curr] === 'object' && obj[curr] !== null) {
        Object.assign(acc, flattenObject(obj[curr], pre + curr));
      } else {
        acc[pre + curr] = obj[curr];
      }

      return acc;
    }, {});
  };

  const getHeaders = data => Array.from(
    data.reduce((acc, curr) => {
      Object.keys(curr).forEach(key => {
        acc.add(key);
      });

      return acc;
    }, new Set())
  );
  
  const replaceEmpty = (key, value) => {
    return value === null ? '' : value;
  };
  
  const parseRow = row => header.map(
    name =>JSON.stringify(row[name], replaceEmpty)
  ).join(',');

  const flatData = data.map(flattenObject);
  const header = getHeaders(flatData);
  const rows = flatData.map(parseRow);
  const rowsWithHeader = [header.join(','), ...rows];
  const csv = rowsWithHeader.join('\r\n');
  
  return csv;
};
