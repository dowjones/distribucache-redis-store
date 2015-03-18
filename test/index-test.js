var proxyquire = require('proxyquire'),
  stub = require('sinon').stub,
  should = require('should');

describe('RedisStore', function () {
  var redisStore, unit, lock, util, redisClient;

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
      hget: noop,
      hset: noop,
      psetex: noop,
      on: noop,
      psubscribe: noop
    });

    util.createRedisClient.returns(redisClient);

    redisStore = proxyquire('../lib', {
      'redis-lockr': lockr,
      './util': util
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

  it('should proxy redis errors', function (done) {
    redisClient.hget.withArgs('k').yields(new Error('bad'));
    unit.getAccessedAt('k', function (err) {
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
    testHget('getAccessedAt', '123', 123, done);
  });

  it('should get createdAt', function (done) {
    testHget('getCreatedAt', '321', 321, done);
  });

  it('should get hash', function (done) {
    testHget('getHash', '32', '32', done);
  });

  it('should get value', function (done) {
    testHget('getValue', '32', '32', done);
  });

  it('should set accessedAt', function (done) {
    testHset('setAccessedAt', done);
  });

  it('should set createdAt', function (done) {
    testHset('setCreatedAt', done);
  });

  it('should set hash', function (done) {
    testHset('setHash', done);
  });

  it('should set value', function (done) {
    testHset('setValue', done);
  });

  it('should set timeout', function (done) {
    redisClient.psetex.yields(null, 'ok');
    unit.setTimeout('k', 1, function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.psetex.calledOnce.should.be.ok;
      done();
    });
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

  function testHget(methodName, input, output, cb) {
    redisClient.hget.withArgs('g').yields(null, input);
    unit[methodName]('g', function (err, data) {
      if (err) return cb(err);
      data.should.equal(output);
      redisClient.hget.calledOnce.should.be.ok;
      cb();
    });
  }

  function testHset(methodName, cb) {
    redisClient.hset.withArgs('g').yields(null, 'ok');
    unit[methodName]('g', 'v', function (err) {
      if (err) return cb(err);
      arguments.length.should.equal(1);
      redisClient.hset.calledOnce.should.be.ok;
      cb();
    });
  }
});

