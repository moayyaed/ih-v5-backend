/**
 * UDP server
 */
const util = require('util');
const dgram = require('dgram');

const appconfig = require('../appconfig');


module.exports = async function(holder) {

  const socket = dgram.createSocket('udp4');
  const serverPort = appconfig.get('port');


  const udpport = 8088;
  let address;

  console.log(`INFO: UDP server has started`, 1);
  socket.on('listening', () => {
    address = socket.address();
    console.log(`INFO: UDP server listening ${address.address}:${address.port}`, 1);
  });

  socket.bind(udpport);

  socket.on('message', (msg, rinfo) => {
    console.log(`INFO: UDP server got: ${msg} from ${rinfo.address}:${rinfo.port}`, 1);
    let reply;
    if (msg == 'IHS') {
      // reply = `Greeting  ${rinfo.address}! Welcome to ${serverIP}:${serverPort}`;
      reply = `Greeting  ${rinfo.address}! Welcome to port ${serverPort}`;
    } else {
      reply = `Unknown keyword!`;
    } 

    socket.send(reply, 0, reply.length, rinfo.port, rinfo.address, err => {
      if (err) {
        console.log('Send ERROR: ' + util.inspect(err));
      } else {
        console.log('Send ' + reply, 1);
      }
    });
  });

  socket.on('error', e => {
    const mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use' : +e.code;
    console.log(`ERROR: UDP server port: ${udpport} error! ${mes}`);
  });
};