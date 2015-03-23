var proxyquire = require('proxyquire'),
  stub = require('sinon').stub,
  should = require('should');

describe('Timer', function () {
  var Timer, util, redisClient;

  beforeEach(function () {
    function noop() {}

    redisClient = stub({psetex: noop, on: noop});
    util = stub({createRedisClient: noop});
    util.createRedisClient.returns(redisClient);

    function Listener(client, config) { this.config = config; }
    Listener.prototype.on = stub();
    Listener.prototype.listen = stub();

    Timer = proxyquire('../lib/Timer', {
      './util': util,
      './ExpiryListener': Listener
    });
  });

  it('should setTimeout', function (done) {
    var t = new Timer(redisClient, {}, 'n');

    function check() {
      redisClient.psetex.calledOnce.should.be.ok;
      done();
    }

    redisClient.psetex.yields(null);
    t.setTimeout('k', 1000, check);
  });
});
