const typed = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array
];

// if (typeof BigInt64Array !== 'undefined')
//  typed.push(BigInt64Array, BigUint64Array);

module.exports = function equal(a, b) {
  if (a === b)
    return true;

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object')
    // true if both NaN, false otherwise
    return a !== a && b !== b;

  const constructor = a.constructor;

  if (constructor !== b.constructor)
    return false;

  if (constructor === RegExp)
    return a.source === b.source && a.flags === b.flags;

  const isArray = Array.isArray(a);
  // .some(...) -> .includes(constructor) would be shorted, but not sure if that works correctly
  if (isArray || (constructor.BYTES_PER_ELEMENT && typed.some(type => a instanceof type))) {
    let i = a.length;

    if (i === b.length) {
      if (isArray)
        while (i-- > 0 && equal(a[i], b[i]));
      else
        while (i-- > 0 && a[i] === b[i]);
    }

    return i === -1;
  }

  const isMap = a instanceof Map;

  if (isMap || a instanceof Set) {
    if (a.size !== b.size)
      return false;

    if (!a.keys().every(b.has))
      return false;

    if (isMap && !a.keys().every(key => equal(a.get(key), b.get(key))))
      return false;

    return true;
  }

  if (a.valueOf !== Object.prototype.valueOf)
    return a.valueOf() === b.valueOf();

  if (a.toString !== Object.prototype.toString)
    return a.toString() === b.toString();

  const keys = Object.keys(a);

  if (keys.length !== Object.keys(b).length)
    return false;

  if (!keys.every(Object.prototype.hasOwnProperty.bind(b)))
    return false;

  return keys.every(key => equal(a[key], b[key]));
}