var proxyquire = require('proxyquire'),
  stub = require('sinon').stub,
  should = require('should');

describe('RedisStore', function () {
  var redisStore, unit, lock,
    util, redisClient;

  beforeEach(function () {
    var lockr;
    function noop() {}

    lockr = stub();
    lock = stub();
    lockr.returns(lock);

    util = stub({
      ensureKeyspaceNotifications: noop,
      createRedisClient: noop
    });

    redisClient = stub({
      del: noop,
      pexpire: noop,
      hget: noop,
      hset: noop,
      psetex: noop,
      on: noop,
      psubscribe: noop
    });

    util.createRedisClient.returns(redisClient);

    function Timer(client, config, nsp) {
      this.nsp = nsp;
    }

    redisStore = proxyquire('../lib', {
      'redis-lockr': lockr,
      './util': util,
      './Timer': Timer
    });

    unit = new redisStore();
  });

  it('should ensureKeyspaceNotifications if configured', function () {
    var store = redisStore({isPreconfigured: true});
    util.ensureKeyspaceNotifications.calledOnce.should.be.ok;
  });

  it('should del', function (done) {
    redisClient.del.withArgs('k').yields(null, 'ok');
    unit.del('k', function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.del.calledOnce.should.be.ok;
      done();
    });
  });

  it('should expire', function (done) {
    redisClient.pexpire.withArgs('k', 7).yields(null, 'ok');
    unit.expire('k', 7, function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.pexpire.calledOnce.should.be.ok;
      done();
    });
  });

  it('should proxy redis errors', function (done) {
    redisClient.hget.withArgs('k').yields(new Error('bad'));
    unit.get('k', 'f', function (err) {
      err.message.should.equal('bad');
      done();
    });
  });

  it('should proxy Redis\' error events', function (done) {
    var call = redisClient.on.firstCall;
    call.args[0].should.equal('error');
    unit.on('error', function (e) {
      e.message.should.equal('good');
      done();
    });
    call.args[1](new Error('good'));
  });

  it('should get accessedAt', function (done) {
    redisClient.hget.withArgs('g').yields(null, 'i');
    unit.get('g', 'f', function (err, data) {
      if (err) return done(err);
      data.should.equal('i');
      redisClient.hget.calledOnce.should.be.ok;
      done();
    });
  });

  it('should set value', function (done) {
    redisClient.hset.withArgs('g').yields(null, 'ok');
    unit.set('g', 'f', 'v', function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.hset.calledOnce.should.be.ok;
      done();
    });
  });

  it('should get a namespaced timer', function () {
    var t = unit.createTimer('b');
    t.nsp.should.eql('b');
  });

  it('should get a store and timer namespaced timer', function () {
    unit = redisStore({namespace: 'n'});
    var t = unit.createTimer('b');
    t.nsp.should.eql('n:b');
  });

  describe('createLease', function () {
    it('should create / release a lease', function (done) {
      var lease = unit.createLease(1);
      lock.yields(null, stub());
      lease('k', function (err, release) {
        if (err) return done(err);
        release();
        lock.calledOnce.should.be.ok;
        done();
      });
    });

    it('should return an AlreadyLeasedError if prev. taken out', function (done) {
      var lease = unit.createLease(1);
      lock.yields(new Error('Exceeded max retry'));
      lease('k', function (err) {
        err.name.should.equal('AlreadyLeasedError');
        done();
      });
    });

    it('should wrap lockr errors in a LeasedError', function (done) {
      var lease = unit.createLease(1);
      lock.yields(new Error('x'));
      lease('k', function (err) {
        err.name.should.equal('LeaseError');
        done();
      });
    });
  });

  describe('_getKey', function () {
    it('should get a namespaced key if namespace is set', function () {
      var storeSim = redisStore(),
        storeNsp = redisStore({namespace: 'n'}),
        key = 'k';
      storeSim._getKey(key).should.equal('k');
      storeNsp._getKey(key).should.equal('n:k');
    });
  });
});

