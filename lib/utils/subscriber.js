/**
 * subscriber.js
 * Объект, реализующий механизм подписки для клиентов
 * На нижнем уровне каждая подписка имеет subid и subobj - параметры для фильтрации данных события
 *
 * Map(key=event: new Map(key=clientId: new Map(key=subid: subobj) ) )
 */

class Subscriber {
  constructor() {
    this.subsMap = new Map();
  }

  // Регистрировать подписку
  addSub(event, cid, subid, subobj) {
    if (!event || !cid) return;
    subid = subid || 1; // Если не передается - будет одна подписка по одному событию
    subobj = subobj || {};

    if (!this.subsMap.has(event)) this.subsMap.set(event, new Map());

    if (!this.subsMap.get(event).has(cid)) this.subsMap.get(event).set(cid, new Map());
    this.subsMap
      .get(event)
      .get(cid)
      .set(subid, subobj);
  }

  // Удалить подписку (отписаться) с конкретным subid для клиента cid (выполняется отписка, event не знаем??)
  unSub(cid, subid) {
    if (!cid || !subid) return;

    for (const cMap of this.subsMap.values()) {
      // по event-ам
      if (cMap.has(cid)) {
        cMap.get(cid).delete(subid); // Если нет - то и нет
      }
    }
  }

  // Удалить подписку на событие event для клиента cid или для всех клиентов
  removeSub(event, cid) {
    if (!event) return;
    const subs = this.subsMap.get(event);
    if (!subs) return;

    if (cid) {
      subs.delete(cid);
    } else this.subsMap.delete(event);
  }

  // Удалить подписки на все события для клиента
  removeAllSubs(cid) {
    if (!cid) return;
    for (const cMap of this.subsMap.values()) {
      cMap.delete(cid); // Если нет - то и нет
    }
  }

  // Проверить подписки на событие event для клиента cid без проверки параметров
  hasClientSubs(event, cid) {
    return event && cid && this.subsMap.has(event) && this.subsMap.get(event).has(cid);
  }

  // Получить подписки на событие event для всех клиентов (с проверкой параметров из paramObj)
  // Вернуть массив объектов - подписчик, id и объект подписки [{cid:cid, subid:subid, subobj}]
  // Дальнейший анализ - в прикладном модуле
  getSubs(event, paramObj) {
    const cMap = this.subsMap.get(event); // По событию для всех клиентов
    if (!cMap) return [];
    const result = [];
    for (const [cid, sMap] of cMap) {
      // По клиентам
      for (const [subid, subobj] of sMap) {
        // По каждому клиенту по подпискам с проверкой параметров из paramObj
        if (compareParam(paramObj, subobj)) result.push({ cid, subid, subobj });
      }
    }
    return result;
  }

  getClientSubs(event, cid, paramObj) {
    if (!event || !cid || !this.subsMap.has(event) || !this.subsMap.get(event).has(cid)) return [];
    const sMap = this.subsMap.get(event).get(cid);
    const result = [];
    for (const [subid, subobj] of sMap) {
      // По клиенту по подпискам с проверкой параметров из paramObj
      if (compareParam(paramObj, subobj)) result.push({ cid, subid, subobj });
    }
    return result;
  }
}

function compareParam(paramObj, subobj) {
  if (!paramObj || !subobj) return true; // берется все

  const parArr = Object.keys(paramObj);
  for (const par of parArr) {
    if (subobj[par] != undefined && subobj[par] != paramObj[par]) return; // есть параметр, и он не совпадает
  }
  return true;
}

module.exports = Subscriber;
