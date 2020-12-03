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
    this.dbcalc_type = doc.dbcalc_type && doc.dbcalc_type != '-' ? doc.dbcalc_type : ''; // min, max, minmax, ...
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

    }
  }

  outOfDelta(val) {
    if (!this.dbdelta || !this.lastSavedTs) return true;
    return Math.abs(val - this.lastSavedVal) >= this.dbdelta;
  }

  onTimer(tname) {
    let toWrite;
    if (tname == 'save') {
      // Периодическая запись по алгоритму 3
      if (this.dbmet == 3 && this.dbtm > 0) {
        toWrite = this.byCalcType();

        this.store = {};
      }
    } else if (tname == 'force') {
    }
    return toWrite;
  }

  byCalcType() {
    const calc_type = this.dbcalc_type;

    let res = [];
    if (calc_type == 'minmax') {
      if (this.store.min != undefined && this.store.max != undefined) {
        if (this.store.min.ts < this.store.max.ts) {
          res.push({ dn, val: this.store.min.val, ts: this.store.min.ts });
          res.push({ dn, val: this.store.max.val, ts: this.store.max.ts });
        } else if (this.store.min.ts > this.store.max.ts) {
          res.push({ dn, val: this.store.max.val, ts: this.store.max.ts });
          res.push({ dn, val: this.store.min.val, ts: this.store.min.ts });
        } else res.push({ dn, val: this.store.max.val, ts: this.store.max.ts });
      }
    } else if (this.store[calc_type]) {
      res.push({ dn, val: this.store[calc_type].val, ts: this.store[calc_type].ts });
    }

    return res;
  }

  // dbcalc_type : last, min, max, minmax, average
  calc(val, ts) {
    if (val == undefined) return;

    const calc_type = this.dbcalc_type || 'last';

    if (calc_type == 'minmax') {
      this.checkElemExists('min');
      if (this.elemShouldRefresh('min', val)) this.store.min = { val, ts };

      this.checkElemExists('max');
      if (this.elemShouldRefresh('max', val)) this.store.max = { val, ts };
    } else if (calc_type == 'average') {
      this.checkElemExists(calc_type);
      this.store[calc_type].sum += Number(val);
      this.store[calc_type].q += 1;

      // Округлять при расчете среднего до 1 цифры после запятой??
      this.store[calc_type].val = Math.round((this.store.average.sum * 10) / this.store.average.q) / 10;
      this.store[calc_type].ts = ts;
    } else {
      this.checkElemExists(calc_type);

      if (this.elemShouldRefresh(calc_type, val)) this.store[calc_type] = { val, ts };
    }
  }

  checkElemExists(elem) {
    if (this.store[elem] == undefined) {
      this.store[elem] = elem == 'average' ? { sum: 0, q: 0 } : {};
    }
  }

  elemShouldRefresh(elem, value) {
    if (this.store[elem].val == undefined) return true;

    try {
      switch (elem) {
        case 'min':
          return Number(value) < Number(this.store[elem].val);
        case 'max':
          return Number(value) > Number(this.store[elem].val);
        default:
          return true;
      }
    } catch (e) {
      return false;
    }
  }
}

module.exports = Trendo;
