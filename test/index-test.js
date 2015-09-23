import proxyquire from 'proxyquire';

describe('distribucache-redis-store', () => {
  it('should create a RedisStore with args', () => {
    function Store(config) {
      this.config = config;
    }

    const store = proxyquire('../src', {
      './RedisStore': Store
    });

    store(87).config.should.equal(87);
  });
});
