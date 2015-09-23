# Distribucache Redis Store [![Build Status](https://secure.travis-ci.org/dowjones/distribucache-redis-store.png)](http://travis-ci.org/dowjones/distribucache-redis-store) [![NPM version](https://badge.fury.io/js/distribucache-redis-store.svg)](http://badge.fury.io/js/distribucache-redis-store)

A Redis datastore for the [Distribucache](https://github.com/dowjones/distribucache) auto-repopulating cache.

## Usage

Here's what a simple service using Distribucache with Redis may look like:

```js
import distribucache from 'distribucache';
import redisStore from 'distribucache-redis-store';
import model from '../model'; // for example

const store = redisStore({host: 'localhost', port: 6379});
const cacheClient = distribucache.createClient(store);

const cache = cacheClient.create('my:values', {
  staleIn: '10 sec',
  populateIn: '5 sec',
  pausePopulateIn: '1 min',
  populate(key, cb) {
    model.get(key, cb);
  }
});

class Service {
  get(key, cb) {
    cache.get(key, cb);
  }
}
```


### API

  - `redisStore(config)`

Possible `config` values below.
```
{String} [config.namespace]
{Boolean} [config.isPreconfigured] defaults to false (see note below)
{Object} [config.options] see ioredis options
```

`isPreconfigured` is used to determine whether the store needs to set-up
keyspace notifications, which are used to support the `populateIn` feature in a
way that multiple Distribucache clients would not conflict with each other while
automatically populating the cache.  Disable this to avoid a warning if you're
running Redis in an environment where `CONFIG` is not available.
One such environment is AWS. There you will need to set the `notify-keyspace-events`
property to `Kx` manually through the AWS Management Console.

In addition to the config above, all of the options defined in
[ioredis](https://github.com/luin/ioredis/blob/master/API.md#new-redisport-host-options)
are allowed to configure the Redis client.


## License

[MIT](/LICENSE)
