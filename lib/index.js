var EventEmitter = require('events').EventEmitter,
  inherits = require('util').inherits,
  assign = require('lodash/object/assign'),
  lockr = require('redis-lockr'),
  Timer = require('./Timer'),
  generateErrorClass = require('common-errors').helpers.generateClass,
  AlreadyLeasedError = generateErrorClass('AlreadyLeasedError'),
  LeaseError = generateErrorClass('LeaseError'),
  util = require('./util'),
  proxyEvent = util.proxyEvent,
  errorOrNothing = util.errorOrNothing,
  DEFAULT_CONFIG = {
    namespace: '',
    isPreconfigured: false
  };

module.exports = RedisStore;

function RedisStore(config) {
  if (!(this instanceof RedisStore)) {
    return new RedisStore(config);
  }

  EventEmitter.call(this);

  this._config = assign({}, DEFAULT_CONFIG, config);
  this._config.namespace = this._config.namespace ?
    (this._config.namespace + ':') : '';

  this._client = util.createRedisClient(this._config);
  this._client.on('error', proxyEvent(this, 'error'));

  if (!this._config.isPreconfigured) {
    util.ensureKeyspaceNotifications(
      this._client, util.logError(this._config.logger));
  }
}

inherits(RedisStore, EventEmitter);

RedisStore.prototype.createLease = function (ttl) {
  var lock = lockr(this._client, {lifetime: ttl}),
    self = this;
  return function lease(key, cb) {
    key = self._getKey(key);
    lock(key, function (err, release) {
      if (err) {
        if (/Exceeded max retry/.test(err.message)) {
          err = new AlreadyLeasedError('lease acquired by another process');
        } else {
          err = new LeaseError('could not aquire lease for: ' + key, err);
        }
      }
      return cb(err, release);
    });
  };
};

RedisStore.prototype.createTimer = function (namespace) {
  var nsp = this._config.namespace + namespace;
  return new Timer(this._client, this._config, nsp);
};

RedisStore.prototype.del = function (key, cb) {
  this._client.del(this._getKey(key), errorOrNothing(cb));
};

RedisStore.prototype.expire = function (key, ttlInMs, cb) {
  this._client.pexpire(this._getKey(key), ttlInMs, errorOrNothing(cb));
};

RedisStore.prototype.get = function (key, field, cb) {
  this._client.hget(this._getKey(key), field, cb);
};

RedisStore.prototype.set = function (key, field, value, cb) {
  this._client.hset(this._getKey(key), field,
    value, errorOrNothing(cb));
};

RedisStore.prototype._getKey = function (key) {
  return this._config.namespace + key;
};
