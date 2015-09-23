import proxyquire from 'proxyquire';
import {stub} from 'sinon';

describe('Timer', () => {
  let Timer, util, redisClient;

  beforeEach(() => {
    function noop() {}

    redisClient = stub({psetex: noop, on: noop});
    util = stub({createRedisClient: noop});
    util.createRedisClient.returns(redisClient);

    function Listener(client, config) {
      this.config = config;
    }
    Listener.prototype.on = stub();
    Listener.prototype.listen = stub();

    Timer = proxyquire('../src/Timer', {
      './util': util,
      './ExpiryListener': Listener
    });
  });

  it('should setTimeout', done => {
    const t = new Timer(redisClient, {}, 'n');

    function check() {
      redisClient.psetex.calledOnce.should.be.ok();
      done();
    }

    redisClient.psetex.yields(null);
    t.setTimeout('k', 1000, check);
  });
});
