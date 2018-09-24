import proxyquire from 'proxyquire';
import {stub} from 'sinon';

describe('RedisStore', () => {
  let RedisStore, unit, lock,
    util, redisClient;

  beforeEach(() => {
    let lockr;
    function noop() {}

    lockr = stub();
    lock = stub();
    lockr.returns(lock);

    util = stub({
      ensureKeyspaceNotifications: noop,
      createRedisClient: noop
    });

    redisClient = stub({
      quit: noop,
      del: noop,
      pexpire: noop,
      hgetBuffer: noop,
      hset: noop,
      hdel: noop,
      hincrby: noop,
      psetex: noop,
      on: noop,
      psubscribe: noop
    });

    util.createRedisClient.returns(redisClient);

    function Timer(client, config, nsp) {
      this.nsp = nsp;
    }

    RedisStore = proxyquire('../src/RedisStore', {
      'redis-lockr': lockr,
      './util': util,
      './Timer': Timer
    });

    unit = new RedisStore();
  });

  it('should ensureKeyspaceNotifications if configured', () => {
    unit = new RedisStore({isPreconfigured: true});
    util.ensureKeyspaceNotifications.calledOnce.should.be.ok();
  });

  it('should quit', done=>{
    redisClient.quit.withArgs().yields(null, 'ok');
    unit.quit(function(err){
      if (err) return done(err);
      redisClient.quit.calledOnce.should.be.ok();
      done();
    })
  });

  it('should del', done => {
    redisClient.del.withArgs('k').yields(null, 'ok');
    unit.del('k', function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.del.calledOnce.should.be.ok();
      done();
    });
  });

  it('should expire', done => {
    redisClient.pexpire.withArgs('k', 7).yields(null, 'ok');
    unit.expire('k', 7, function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.pexpire.calledOnce.should.be.ok();
      done();
    });
  });

  it('should proxy redis errors', done => {
    redisClient.hgetBuffer.withArgs('k').yields(new Error('bad'));
    unit.getProp('k', 'f', err => {
      err.message.should.equal('bad');
      done();
    });
  });

  it('should proxy Redis\' error events', done => {
    const call = redisClient.on.firstCall;
    call.args[0].should.equal('error');
    unit.on('error', e => {
      e.message.should.equal('good');
      done();
    });
    call.args[1](new Error('good'));
  });

  it('should get property', done => {
    redisClient.hgetBuffer.withArgs('g').yields(null, 'i');
    unit.getProp('g', 'f', (err, data) => {
      if (err) return done(err);
      data.should.equal('i');
      redisClient.hgetBuffer.calledOnce.should.be.ok();
      done();
    });
  });

  it('should set property', done => {
    redisClient.hset.withArgs('g').yields(null, 'ok');
    unit.setProp('g', 'f', 'v', function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.hset.calledOnce.should.be.ok();
      done();
    });
  });

  it('should increment property', done => {
    redisClient.hincrby.withArgs('g', 'f', 10).yields(null, 11);
    unit.incrPropBy('g', 'f', 10, (err, updatedValue) => {
      if (err) return done(err);
      updatedValue.should.equal(11);
      redisClient.hincrby.calledOnce.should.be.ok();
      done();
    });
  });

  it('should delete property', done => {
    redisClient.hdel.withArgs('g').yields(null, 'ok');
    unit.delProp('g', 'f', function (err) {
      if (err) return done(err);
      arguments.length.should.equal(1);
      redisClient.hdel.calledOnce.should.be.ok();
      done();
    });
  });

  it('should get a namespaced timer', () => {
    const t = unit.createTimer('b');
    t.nsp.should.eql('b');
  });

  it('should get a store and timer namespaced timer', () => {
    unit = new RedisStore({namespace: 'n'});
    const t = unit.createTimer('b');
    t.nsp.should.eql('n:b');
  });

  describe('createLease', () => {
    it('should create / release a lease', done => {
      const lease = unit.createLease(1);
      lock.yields(null, stub());
      lease('k', (err, release) => {
        if (err) return done(err);
        release();
        lock.calledOnce.should.be.ok();
        done();
      });
    });

    it('should return an AlreadyLeasedError if prev. taken out', done => {
      const lease = unit.createLease(1);
      lock.yields(new Error('Exceeded max retry'));
      lease('k', err => {
        err.name.should.equal('AlreadyLeasedError');
        done();
      });
    });

    it('should wrap lockr errors in a LeasedError', done => {
      const lease = unit.createLease(1);
      lock.yields(new Error('x'));
      lease('k', err => {
        err.name.should.equal('LeaseError');
        done();
      });
    });
  });

  describe('_getKey', () => {
    it('should get a namespaced key if namespace is set', () => {
      const storeSim = new RedisStore();
      const storeNsp = new RedisStore({namespace: 'n'});
      const key = 'k';
      storeSim._getKey(key).should.equal('k');
      storeNsp._getKey(key).should.equal('n:k');
    });
  });
});
