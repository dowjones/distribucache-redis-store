import joi from 'joi';
import {EventEmitter} from 'events';

/**
 * Listen to expiring keys in Redis
 *
 * Emits events:
 *   - listen - when listening to expiring keys
 *   - stop - stopped listening
 *   - expire - called when a key expires
 *       arguments: ({String} key, {Function} unlock)
 *       call the 'unlock' function when done.
 */

export default class ExpiryListener extends EventEmitter {
  /**
   * @param {RedisClient} subClient
   * @param {Object} [config]
   * @param {String} [config.keyspace]
   */

  constructor(subClient, config) {
    super();
    config = this._validateConfig(config || {});
    this._subClient = subClient;
    this._channel = '__keyspace@0__:' + config.keyspace;
    this._patternRe = getPatternRe(this._channel);
  }

  /**
   * Enable redis keyspace events and
   * subscribe to the trigger events
   */

  listen() {
    const client = this._subClient;
    client.psubscribe(this._channel);
    client.on('pmessage', this._onExpiry.bind(this));
    this.emit('listen');
  }

  /**
   * Stop listening to keyspace expiry events.
   */

  stopListening() {
    this._subClient.punsubscribe(this._channel, err => {
      if (err) this.emit('error', err);
      this.emit('stop');
    });
  }

  /**
   * Validate and set defaults on the config.
   * Throw if the config is invalid.
   */

  _validateConfig(config) {
    const validation = joi.validate(config, joi.object().keys({
      keyspace: joi.string().required()
    }));
    if (validation.error) throw validation.error;
    return validation.value;
  }

  /**
   * On every event, emit the `expired` event with the key
   */

  _onExpiry(pattern, channel, message) {
    let key;

    if (message.toString() !== 'expired' ||
        this._channel !== pattern) return;

    key = channel.match(this._patternRe)[1];

    this.emit('expired', key);
  }
}

function getPatternRe(pattern) {
  return new RegExp(pattern.replace('*', '(.*)'));
}
