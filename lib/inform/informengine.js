/**
 * Информирование
 * Принимает запросы на отправку сообщений: {type:'email', }
 *    1. если плагина нет или он не запущен - ошибка
 *    2. формирует адреса для отправки - таблица infoaddr
 *    3. считает число отправленных сообщений адресату (или всего?) за период
 *      (ограничить число сообщений в форс-мажорных ситуациях)
 *    4. Передает для отправки соотв плагину
 *       (каждому сообщению присваивается uuid)
 *    5. Слушает результат отправки??
 */

class Informengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;
  }

  start() {
    this.holder.on('info:send', (sendObj, callback) => {
      this.sendInfo(sendObj);
    });
    // this.holder.on('info:result', sendResult);
  
  }

  async sendInfo(sendObj) {
    

  }


}

module.exports = Informengine;