import {EventEmitter} from 'events';
import ExpiryListener from './ExpiryListener';
import {createRedisClient, proxyEvent, errorOrNothing} from './util';

export default class Timer extends EventEmitter {
  constructor(pubClient, redisConfig, namespace) {
    super();

    this._namespace = namespace + ':';
    this._pubClient = pubClient;

    this._subClient = createRedisClient(redisConfig);
    this._subClient.on('error', proxyEvent(this, 'error'));

    const listenerConfig = {keyspace: this._namespace + '*:trigger'};
    const listener = new ExpiryListener(this._subClient, listenerConfig);
    listener.on('error', proxyEvent(this, 'error'));
    listener.on('expired', proxyEvent(this, 'timeout'));
    listener.listen();
  }

  setTimeout(key, ttl, cb) {
    this._pubClient.psetex(this._getKey(key) + ':trigger',
      ttl, '', errorOrNothing(cb));
  }

  _getKey(key) {
    return this._namespace + key;
  }
}
