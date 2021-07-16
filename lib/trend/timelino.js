/**
 * timelino.js
 * Хранит незавершенные интервалы до сохранения в БД для отдельной метрики (trendId = did_prop)
 *
 */
class Timelino {
  constructor(trendId, doc) {
    this.id = trendId; // did_prop
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
    let toSave;

    if (this.start && this.state != val) {
      // Создать завершенный интервал
      toSave = { dn: this.dn, prop: this.prop, start: this.start, end: ts - 1, state: String(this.state) };
    }
    // Начать новый
    this.start = ts;
    this.state = val;
    return toSave;
  }
}

module.exports = Timelino;
