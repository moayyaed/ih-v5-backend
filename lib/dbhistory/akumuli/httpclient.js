const http = require('http');

module.exports = function(postData, dbagent) {
  const options = {
//    hostname: 'localhost',
    port: 8181,
    path: '/api/query',
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', chunk => {
      console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
      console.log('No more data in response.');
    });
  });

  req.setHeader('Content-Type', 'application/json');

  req.on('error', e => {
    console.error(`problem with request: ${e.message}`);
  });

  // Write data to request body
  req.write(postData);
  req.end();
};
