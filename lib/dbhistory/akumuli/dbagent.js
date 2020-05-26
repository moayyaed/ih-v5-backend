/**
 * БД на akumuli
 *  - Запись через TCP
 *  - Чтение через HTTP
 *  - Сам akumuli уже запущен отдельно??
 * 
 */

const util = require('util');
const net = require('net');

const EventEmitter = require('events');

class Dbagent extends EventEmitter {
  /*
  constructor() {
    super();
  }
  */

  start() {
    // TCP клиент - на запись
    this.client = net.createConnection({ port: 8282 }, () => {
      // 'connect' listener.
      console.log('connected to Akumuli TCP server!');
    });

    // Отвечает, только если есть ошибка
    this.client.on('data', (data) => {
      console.log(data.toString());
      this.client.end();
    });
    
    this.client.on('end', () => {
      console.log('disconnected from Akumuli TCP server');
    });

    this.client.on('error', (e) => {
      console.log('Akumuli TCP server Connection error:'+util.inspect(e));
    });
    
    // На чтение - HTTP клиент, GET и POST запросы

  }

  execute(message) {
    // Выполнить запрос на запись
    this.client.write('world\r\n');
  }
}

// module.exports = new Dbagent();
module.exports = Dbagent;
