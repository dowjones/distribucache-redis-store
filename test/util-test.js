var stub = require('sinon').stub,
  proxyquire = require('proxyquire');

describe('datastore/redis/util', function () {
  var util, redis;

  function noop () {}

  beforeEach(function () {
    redis = stub({createClient: noop});
    util = proxyquire('../lib/util', {
      redis: redis
    });
  });

  describe('ensureKeyspaceNotifications', function () {
    var client;

    beforeEach(function () {
      client = {config: stub()};
    });

    it('should emit an error on err', function (done) {
      function check(err) {
        err.message.should.equal('bad');
        done();
      }
      client.config.yields(new Error('bad'));
      util.ensureKeyspaceNotifications(client, check);
    });

    it('should warn if the config command is restricted', function (done) {
      stub(console, 'warn');
      function check(err, response) {
        if (err) return done(err);
        response.should.equal('NOT CONFIGURED');
        console.warn.calledOnce.should.be.ok;
        console.warn.restore();
        done();
      }
      client.config.yields(new Error('unknown command \'config\''));
      util.ensureKeyspaceNotifications(client, check);
    });

    it('should warn if Redis version does not support keyspace events', function (done) {
      function check(err, response) {
        if (err) return done(err);
        response.should.equal('NOT CONFIGURED');
        console.warn.firstCall.args[0].should.match(/Redis >=2.8.0/);
        console.warn.restore();
        done();
      }
      stub(console, 'warn');
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, []);
      client.config.withArgs('set', 'notify-keyspace-events', 'Kx').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, check);
    });

    it('should set keyspace and expired notifications and emit expired', function (done) {
      function check(err, response) {
        if (err) return done(err);
        response.should.equal('ok');
        done();
      }
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', '']);
      client.config.withArgs('set', 'notify-keyspace-events', 'Kx').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, check);
    });

    it('should only set expired notifications if keyspace are set', function (done) {
      function check(err, response) {
        if (err) return done(err);
        response.should.equal('ok');
        done();
      }
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', 'K']);
      client.config.withArgs('set', 'notify-keyspace-events', 'Kx').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, check);
    });

    it('should only set keyspace notifications if expired are set', function (done) {
      function check(err, response) {
        if (err) return done(err);
        response.should.equal('ok');
        done();
      }
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', 'x']);
      client.config.withArgs('set', 'notify-keyspace-events', 'xK').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, check);
    });

    it('should not set notifications if already set', function (done) {
      function check(err, response) {
        if (err) return done(err);
        response.should.equal('CONFIGURED');
        done();
      }
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', 'Kx']);
      util.ensureKeyspaceNotifications(client, check);
    });
  });

  describe('createRedisClient', function () {
    it('should create a brand new redis client', function () {
      redis.createClient.returns(stub({}));
      util.createRedisClient().should.be.type('object');
    });

    it('should create an authenticated redis client', function () {
      redis.createClient.returns(stub({auth: noop}));
      util.createRedisClient({password: 'p'}).should.be.type('object');
    });
  });

  describe('logError', function () {
    it('should log the error if exist', function (done) {
      var logger = {
        error: function (err) {
          err.should.equal('e');
          done();
        }
      };
      util.logError(logger)('e');
    });

    it('should do nothing if no error', function () {
      util.logError()(null);
    });
  });
});
