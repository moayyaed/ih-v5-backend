/**
 * timelino.js
 * Хранит незавершенные интервалы до сохранения в БД для отдельной метрики (trendId = did_prop)
 *
 */
class Timelino {
  constructor(trendId, doc) {
    this.id = trendId; // dn_prop
    this.prop = doc.prop; // Не меняется
    this.update(doc);
  }

  update(doc) {
    this.dn = doc.dn; // Может измениться
  }

  reset() {
    this.lastSavedTs = 0; // Пока ничего не сохраняли
    this.lastSavedVal = 0;
  }

  /**
   *
   * @param {Number} val
   * @param {Number} ts
   */
  onChange(val, ts) {
    let wriObj;
    let curObj;

    if (this.start && this.state != val) {
      // Создать завершенный интервал
      // wriObj = { dn: this.dn, prop: this.prop, start: this.start, end: ts - 1, state: String(this.state) };
      wriObj = this.getCompleted(this, ts - 1);
    }

    if (val > 0) {
      // Начать новый
      this.start = ts;
      this.state = val;
      curObj = { _id: this.id, start: ts, state: this.state };
    } else {
      this.start = 0;
      this.state = 0;
    }

    console.log('Timelino onChange id=' + this.id);
    // this.dm.upsertDocs('timelinecurrent', [{_id:this.id,  start:ts, state: val}]);
    return { wriObj, curObj };
  }

  getCompleted({ dn, prop, start, state }, end) {
    return { dn, prop, start, end, state: String(state) };
  }
}

module.exports = Timelino;
