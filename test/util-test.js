/* eslint no-console: 0 */

import {stub} from 'sinon';
import proxyquire from 'proxyquire';

describe('datastore/redis/util', () => {
  let util, redis;

  function noop () {}

  beforeEach(() => {
    redis = stub({createClient: noop});
    util = proxyquire('../src/util', {
      redis: redis
    });
  });

  describe('ensureKeyspaceNotifications', () => {
    let client;

    beforeEach(() => {
      client = {config: stub()};
    });

    it('should emit an error on err', done => {
      client.config.yields(new Error('bad'));
      util.ensureKeyspaceNotifications(client, err => {
        err.message.should.equal('bad');
        done();
      });
    });

    it('should warn if the config command is restricted', done => {
      stub(console, 'warn');
      client.config.yields(new Error('unknown command \'config\''));
      util.ensureKeyspaceNotifications(client, (err, response) => {
        if (err) return done(err);
        response.should.equal('NOT CONFIGURED');
        console.warn.calledOnce.should.be.ok();
        console.warn.restore();
        done();
      });
    });

    it('should warn if Redis version does not support keyspace events', done => {
      stub(console, 'warn');
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, []);
      client.config.withArgs('set', 'notify-keyspace-events', 'Kx').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, (err, response) => {
        if (err) return done(err);
        response.should.equal('NOT CONFIGURED');
        console.warn.firstCall.args[0].should.match(/Redis >=2.8.0/);
        console.warn.restore();
        done();
      });
    });

    it('should set keyspace and expired notifications and emit expired', done => {
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', '']);
      client.config.withArgs('set', 'notify-keyspace-events', 'Kx').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, (err, response) => {
        if (err) return done(err);
        response.should.equal('ok');
        done();
      });
    });

    it('should only set expired notifications if keyspace are set', done => {
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', 'K']);
      client.config.withArgs('set', 'notify-keyspace-events', 'Kx').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, (err, response) => {
        if (err) return done(err);
        response.should.equal('ok');
        done();
      });
    });

    it('should only set keyspace notifications if expired are set', done => {
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', 'x']);
      client.config.withArgs('set', 'notify-keyspace-events', 'xK').yields(null, 'ok');
      util.ensureKeyspaceNotifications(client, (err, response) => {
        if (err) return done(err);
        response.should.equal('ok');
        done();
      });
    });

    it('should not set notifications if already set', done => {
      client.config.withArgs('get', 'notify-keyspace-events').yields(null, ['', 'Kx']);
      util.ensureKeyspaceNotifications(client, (err, response) => {
        if (err) return done(err);
        response.should.equal('CONFIGURED');
        done();
      });
    });
  });

  describe('createRedisClient', () => {
    it('should create a brand new redis client', () => {
      redis.createClient.returns(stub({}));
      util.createRedisClient().should.be.type('object');
    });

    it('should create an authenticated redis client', () => {
      redis.createClient.returns(stub({auth: noop}));
      util.createRedisClient({password: 'p'}).should.be.type('object');
    });
  });

  describe('logError', () => {
    it('should log the error if exist', done => {
      const logger = {
        error(err) {
          err.should.equal('e');
          done();
        }
      };
      util.logError(logger)('e');
    });

    it('should do nothing if no error', () => {
      util.logError()(null);
    });
  });
});
