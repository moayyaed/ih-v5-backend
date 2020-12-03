/**
 * trendo.js
 * Хранит правила сохранения в БД для отдельной метрики (trendId = did_prop) и промежуточные данные для периодических расчетов
 *
 */
class Trendo {
  /**
   * @param {Object} doc - запись из таблицы - правила сохранения в БД
   */

  constructor(trendId, doc) {
    this.id = trendId; // did_prop
    this.prop = doc.prop; // Не меняется
    this.update(doc);
  }

  update(doc) {
    this.dn = doc.dn; // Может измениться
    this.dbmet = doc.dbmet || 0;
    this.dbtm = doc.dbtm || 0;
    this.dbdelta = doc.dbdelta || 0;
    this.dbcalc_type = doc.dbcalc_type && doc.dbcalc_type != '-' ? doc.dbcalc_type : 'last'; // min, max, minmax, ...
    this.dbforce = doc.dbforce || 0;

    this.reset();
  }

  reset() {
    this.calcStore = {};
    this.lastSavedTs = 0; // Пока ничего не сохраняли
    this.lastSavedVal = 0;
  }

  /**
   *
   * @param {Number} val
   * @param {Number} ts
   */
  onChange(val, ts) {
    if (this.dbmet == 1) {
      // При изменении
      return this.outOfDelta(val) ? { dn: this.dn, prop: this.prop, val, ts } : '';
    }

    if (this.dbmet == 3) {
      // Периодически - не писать, сохранить по алгоритму
      this.calc(val, ts);
    }
  }

  outOfDelta(val) {
    if (!this.dbdelta || !this.lastSavedTs) return true;
    return Math.abs(val - this.lastSavedVal) >= this.dbdelta;
  }

  onTimer(tname) {
    if (tname == 'save') return this.getByCalcType(true); // Периодическая запись по алгоритму 3

    // if (tname == 'force')
  }

  /**
   * 
   * @param {Bool} reset - флаг сброса calcStore
   * @return {Array} toWrite 
   */
  getByCalcType(reset) {
    switch (this.dbcalc_type) {
      case 'minmax':
        return this.getMinMax(reset);

      case 'mean':
        return this.getMean(reset);

      default:
        return this.getOtherCalcType(reset);
    }
  }

  getOtherCalcType(reset) {
    const calcObj  = this.getFromCalcStore(this.dbcalc_type, reset);
    return calcObj ? [calcObj] : [];
  }

  getMean(reset) {
    if (!this.calcStore.mean || !this.calcStore.mean.ts || !this.calcStore.mean.arr) return [];
   
    const arr = this.calcStore.mean.arr;
    if (!this.calcStore.mean.arr.length) return [];
  
    const val = Math.round((arr.reduce((sum, el) => sum + el, 0) * 100) / arr.length) / 100; // Среднее - 2 знака
    const ts = this.calcStore.mean.ts;
   
    if (reset)  {
      this.calcStore.mean.ts = 0;
      this.calcStore.mean.arr = [];
    }
    return [{ dn: this.dn, prop: this.prop, val, ts }];
  }

  getMinMax(reset) {
    const minObj = this.getFromCalcStore('min', reset);
    const maxObj = this.getFromCalcStore('max', reset);
    if (!minObj || !maxObj) return [];

    if (minObj.ts == maxObj.ts) return [maxObj];
    return minObj.ts < maxObj.ts ? [minObj, maxObj] : [maxObj, minObj];
  }

  getFromCalcStore(calc_type, reset) {
    if (!this.calcStore[calc_type] || !this.calcStore[calc_type].ts) return;
    const ts = this.calcStore[calc_type].ts;
    if (reset)  this.calcStore[calc_type].ts = 0;
    return { dn: this.dn, prop: this.prop, val: this.calcStore[calc_type].val, ts};
  }

  // dbcalc_type : first, last, min, max, minmax, mean (average)
  calc(val, ts) {
    if (!ts || val == undefined) return;

    const calc_type = this.dbcalc_type;

    if (calc_type == 'minmax') {
      this.createElemIfNotExists('min');
      if (this.elemShouldRefresh('min', val)) this.calcStore.min = { val, ts };

      this.createElemIfNotExists('max');
      if (this.elemShouldRefresh('max', val)) this.calcStore.max = { val, ts };
    } else if (calc_type == 'mean') {
      this.createElemIfNotExists(calc_type);
      this.calcStore[calc_type].arr.push(Number(val));
      this.calcStore[calc_type].ts = ts;

      // Округлять при расчете среднего до 1 цифры после запятой??
      // this.store[calc_type].val = Math.round((this.store.average.sum * 10) / this.store.average.q) / 10;
    } else {
      // first, last, min, max
      this.createElemIfNotExists(calc_type);
      if (this.elemShouldRefresh(calc_type, val)) this.calcStore[calc_type] = { val, ts };
    }
  }

  createElemIfNotExists(elem) {
    if (this.calcStore[elem] == undefined) {
      this.calcStore[elem] = elem == 'mean' ? { arr: [] } : {};
    }
  }

  elemShouldRefresh(elem, value) {
    if (!this.calcStore[elem].ts || this.calcStore[elem].val == undefined) return true;

    try {
      switch (elem) {
        case 'min':
          return Number(value) < Number(this.calcStore[elem].val);
        case 'max':
          return Number(value) > Number(this.calcStore[elem].val);
        case 'first':
          // return !this.calcStore[elem].ts; // Только если нет сохраненного?? - выполнится на входе
          return false;

        case 'last':
          return true;

        default:
          return true;
      }
    } catch (e) {
      return false;
    }
  }
}

module.exports = Trendo;
