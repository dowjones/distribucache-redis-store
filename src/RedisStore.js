import {EventEmitter} from 'events';
import assign from 'lodash/object/assign';
import lockr from 'redis-lockr';
import Timer from './Timer';
import commonErrors from 'common-errors';
import {
  createRedisClient,
  ensureKeyspaceNotifications,
  errorOrNothing,
  logError,
  proxyEvent
} from './util';

const generateErrorClass = commonErrors.helpers.generateClass;
const AlreadyLeasedError = generateErrorClass('AlreadyLeasedError');
const LeaseError = generateErrorClass('LeaseError');
const DEFAULT_CONFIG = {namespace: '', isPreconfigured: false};

export default class RedisStore extends EventEmitter {
  constructor(config) {
    super();

    this._config = assign({}, DEFAULT_CONFIG, config);
    this._config.namespace = this._config.namespace ?
      (this._config.namespace + ':') : '';

    this._client = createRedisClient(this._config);
    this._client.on('error', proxyEvent(this, 'error'));

    if (!this._config.isPreconfigured) {
      ensureKeyspaceNotifications(
        this._client, logError(this._config.logger));
    }
  }

  createLease(ttl) {
    const lock = lockr(this._client, {lifetime: ttl});
    return (key, cb) => {
      key = this._getKey(key);
      lock(key, (err, release) => {
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
  }

  createTimer(namespace) {
    const nsp = this._config.namespace + namespace;
    return new Timer(this._client, this._config, nsp);
  }

  del(key, cb) {
    this._client.del(this._getKey(key), errorOrNothing(cb));
  }

  expire(key, ttlInMs, cb) {
    this._client.pexpire(this._getKey(key), ttlInMs, errorOrNothing(cb));
  }

  getProp(key, field, cb) {
    this._client.hgetBuffer(this._getKey(key), field, cb);
  }

  setProp(key, field, value, cb) {
    this._client.hset(this._getKey(key), field,
      value, errorOrNothing(cb));
  }

  incrPropBy(key, field, value, cb) {
    this._client.hincrby(this._getKey(key), field, value, cb);
  }

  delProp(key, field, cb) {
    this._client.hdel(this._getKey(key), field, errorOrNothing(cb));
  }

  _getKey(key) {
    return this._config.namespace + key;
  }
}
