var EventEmitter = require('events').EventEmitter,
  inherits = require('util').inherits,
  assign = require('lodash/object/assign'),
  lockr = require('redis-lockr'),
  ExpiryListener = require('./ExpiryListener'),
  generateErrorClass = require('common-errors').helpers.generateClass,
  AlreadyLeasedError = generateErrorClass('AlreadyLeasedError'),
  LeaseError = generateErrorClass('LeaseError'),
  util = require('./util'),
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

  this._initTimeoutEvents();
}

inherits(RedisStore, EventEmitter);

RedisStore.prototype.createLease = function (ttl) {
  var lock = lockr(this._client, {lifetime: ttl});
  return function lease(key, cb) {
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

RedisStore.prototype.del = function (key, cb) {
  this._client.del(this._getKey(key), errorOrNothing(cb));
};

RedisStore.prototype.getAccessedAt = function (key, cb) {
  this._client.hget(this._getKey(key), 'accessedAt', toNumber(cb));
};

RedisStore.prototype.getCreatedAt = function (key, cb) {
  this._client.hget(this._getKey(key), 'createdAt', toNumber(cb));
};

RedisStore.prototype.getHash = function (key, cb) {
  this._client.hget(this._getKey(key), 'hash', cb);
};

RedisStore.prototype.getValue = function (key, cb) {
  this._client.hget(this._getKey(key), 'value', cb);
};

RedisStore.prototype.setAccessedAt = function (key, date, cb) {
  this._client.hset(this._getKey(key), 'accessedAt',
    date, errorOrNothing(cb));
};

RedisStore.prototype.setCreatedAt = function (key, date, cb) {
  this._client.hset(this._getKey(key), 'createdAt',
    date, errorOrNothing(cb));
};

RedisStore.prototype.setHash = function (key, hash, cb) {
  this._client.hset(this._getKey(key), 'hash',
    hash, errorOrNothing(cb));
};

RedisStore.prototype.setValue = function (key, value, cb) {
  this._client.hset(this._getKey(key), 'value',
    value, errorOrNothing(cb));
};

RedisStore.prototype._getKey = function (key) {
  return this._config.namespace + key;
};

/**
 * Enables the sets up the `setTimeout()` and
 * exposes the `timedout` events.
 *
 * Exposing `setTimeout()` this way is less transparent,
 * but it prevents a client from calling this method
 * without enabling the `emitOnExpired`.
 */

RedisStore.prototype._initTimeoutEvents = function () {
  var subClient, keyspace, listener;

  subClient = util.createRedisClient(this._config);
  subClient.on('error', proxyEvent(this, 'error'));

  keyspace = this._config.namespace + '*:trigger';
  listener = new ExpiryListener(subClient, {keyspace: keyspace});
  listener.on('error', proxyEvent(this, 'error'));
  listener.on('expired', proxyEvent(this, 'timeout'));
  listener.listen();

  this.setTimeout = function (key, ttl, cb) {
    this._client.psetex(this._getKey(key) + ':trigger',
      ttl, '', errorOrNothing(cb));
  };
};

/**
 * Proxy all redis events to the
 * CacheClient error events.
 *
 * @private
 * @param {EventEmitter} eventEmitter
 * @param {String} eventName
 */

function proxyEvent(eventEmitter, eventName) {
  return function (data) {
    eventEmitter.emit(eventName, data);
  };
}

function toNumber(cb) {
  return function (err, value) {
    if (err) return cb(err);
    cb(null, value && parseInt(value, 10));
  };
}

function errorOrNothing(cb) {
  return function (err) {
    cb(err);
  };
}
