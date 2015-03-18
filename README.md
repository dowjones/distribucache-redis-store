# Distribucache Redis Store

A Redis datastore for the [Distribucache](https://github.com/areusjs/distribucache) auto-repopulating cache.

Usage (example service):

```js
var distribucache = require('distribucache'),
  redisStore = require('distribucache-redis-store'),

  cacheClient = distribucache.createClient(redisStore({
    host: 'localhost',
    port: 6379
  })),

  cache,
  Service;

cache = cacheClient.create('my:values', {
  staleIn: '10 sec',
  populateIn: '5 sec',
  pausePopulateIn: '1 min',
  populate: function (key, cb) {
    model.get(key, cb);
  }
});

Service.get = function (key, cb) {
  cache.get(key, cb);
};
```

## License

[MIT](/LICENSE)
