module.exports = Apiobj;

/**
 * @param {Object} params - optional
 */
function Apiobj(name, parent) {
  if (!(this instanceof Apiobj)) return new Apiobj(name, parent);
  this.name = name;
  this.parent = parent;
}

Apiobj.prototype.get = function(filter) {
    return this.parent.get(this.name, filter);
}

Apiobj.prototype.set = function(data) {
  return this.parent.set(this.name, data);
}

Apiobj.prototype.onChange = function(filter, cb) {
    this.parent.onChange(this.name, filter, cb);
}

Apiobj.prototype.onAdd = function(filter, cb) {
    this.parent.onAdd(this.name, filter, cb);
}

Apiobj.prototype.onDelete = function(filter, cb) {
    this.parent.onDelete(this.name, filter, cb);
}

Apiobj.prototype.onUpdate = function(filter, cb) {
    this.parent.onUpdate(this.name, filter, cb);
}