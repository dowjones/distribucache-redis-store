var EventEmitter = require('events').EventEmitter,
  inherits = require('util').inherits,
  ExpiryListener = require('./ExpiryListener'),
  util = require('./util'),
  proxyEvent = util.proxyEvent,
  errorOrNothing = util.errorOrNothing,
  Timer;

module.exports = Timer;

function Timer(pubClient, redisConfig, namespace) {
  var listener, listenerConfig;
  EventEmitter.call(this);

  this._namespace = namespace + ':';
  this._pubClient = pubClient;

  this._subClient = util.createRedisClient(redisConfig);
  this._subClient.on('error', proxyEvent(this, 'error'));

  listenerConfig = {keyspace: this._namespace + '*:trigger'};
  listener = new ExpiryListener(this._subClient, listenerConfig);
  listener.on('error', proxyEvent(this, 'error'));
  listener.on('expired', proxyEvent(this, 'timeout'));
  listener.listen();
}

inherits(Timer, EventEmitter);

Timer.prototype.setTimeout = function (key, ttl, cb) {
  this._pubClient.psetex(this._getKey(key) + ':trigger',
    ttl, '', errorOrNothing(cb));
};

Timer.prototype._getKey = function (key) {
  return this._namespace + key;
};
