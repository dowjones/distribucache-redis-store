/* eslint no-console: 0 */

import Redis from 'ioredis';

const KEYSPACE_WARNING = '[distribucache] could not check and ' +
    '"set notify-keyspace-events Kx". ';
const RECONNECT_WARNING = '[distribucache] reconnecting redis ' +
    'due to an error';

/**
 * Set the 'notify-keyspace-events' config in Redis
 *
 * @param {RedisClient} client
 * @param {Function} cb
 */

export function ensureKeyspaceNotifications(client, cb) {
  function maybeSet(err, config) {
    if (err) {
      if (!/unknown command 'config'/.test(err.message)) return cb(err);
      console.warn(KEYSPACE_WARNING + 'You will need to configure it ' +
        'manually for this Redis instance.');
      return cb(null, 'NOT CONFIGURED');
    }

    if (config.length === 0) {
      console.warn(KEYSPACE_WARNING + 'This feature requires Redis >=2.8.0.');
      return cb(null, 'NOT CONFIGURED');
    }

    let cfg = config[1].toString(); // e.g., 0 -> "notify-keyspace-events", 1 -> "xK"
    if (cfg.indexOf('K') > -1 && cfg.indexOf('x') > -1) return cb(null, 'CONFIGURED');
    if (cfg.indexOf('K') === -1) cfg += 'K'; // keyspace events
    if (cfg.indexOf('x') === -1) cfg += 'x'; // notify on expire

    client.config('set', 'notify-keyspace-events', cfg, cb);
  }

  client.config('get', 'notify-keyspace-events', maybeSet);
}

/**
 * Create a new Redis client
 *
 * @param {Object} [cfg]
 * @param {String} [cfg.host] defaults to 'localhost'
 * @param {Number} [cfg.port] defaults to 6379
 * @param {String} [cfg.password]
 */

export function createRedisClient(cfg) {
  cfg = cfg || {};
  addReconnectOnReadonly(cfg);
  return new Redis(cfg);
}

/**
 * Helper to be passed to functions
 * that do not need to callback, but
 * do need to log in case of an error;
 *
 * @param {Object} [logger] defaults to `console`
 * @returns {Function} (err)
 */

export function logError(logger) {
  logger = logger || console;
  return err => err && logger.error(err);
}

/**
 * Proxy all redis events to the
 * CacheClient error events.
 *
 * @private
 * @param {EventEmitter} eventEmitter
 * @param {String} eventName
 */

export function proxyEvent(eventEmitter, eventName) {
  return data => eventEmitter.emit(eventName, data);
}

export function errorOrNothing(cb) {
  return err => cb(err);
}

/**
 * This is necessary for the store to handle the case when
 * another master is selected in ElastiCache, while
 * connecting to the Primary Endpoint.
 *
 * @see https://github.com/dowjones/distribucache-redis-store/issues/3
 * @see https://github.com/luin/ioredis#reconnect-on-error
 */

function addReconnectOnReadonly(cfg) {
  const noop = () => false;
  const userReconn = (typeof cfg.reconnectOnError === 'function') ? cfg.reconnectOnError : noop;
  cfg.reconnectOnError = err => {
    const shouldReconnect = (isReadonlyError(err) || userReconn(err)) ? 2 : false;
    if (shouldReconnect) console.warn(RECONNECT_WARNING);
    return shouldReconnect;
  };
}

function isReadonlyError(err) {
  return /READONLY\b/.test(err.message);
}
