/* eslint no-console: 0 */

import {stub} from 'sinon';
import proxyquire from 'proxyquire';

describe('datastore/redis/util', () => {
  let util, Redis;

  beforeEach(() => {
    Redis = function (config) {
      this.config = config;
    };
    Redis.prototype.isFakeRedisClient = () => true;
    util = proxyquire('../src/util', {
      ioredis: Redis
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
      const client = util.createRedisClient({d: 2});
      client.isFakeRedisClient().should.be.ok();
      client.config.d.should.eql(2);
    });

    // describe('with ability to quit', () => {
    //   let r = util.createRedisClient();
    //   r.quit();
    // });

    describe('with ability to reconnect on error', () => {
      let re;

      beforeEach(() => {
        re = util.createRedisClient().config.reconnectOnError;
      });

      it('should not reconn un unknown errors', () => {
        re({message: 'unknown'}).should.equal(false);
      });

      it('should reconn on READONLY errors', () => {
        stub(console, 'warn');
        re({message: 'blah -READONLY oh no'}).should.equal(2);
        console.warn.calledOnce.should.be.ok();
        console.warn.restore();
      });

      it('should reconn on user-provided errors', () => {
        stub(console, 'warn');
        re = util.createRedisClient({
          reconnectOnError(err) {
            return err.message === 'userprov';
          }
        }).config.reconnectOnError;
        re({message: 'userprov'}).should.be.ok();
        console.warn.calledOnce.should.be.ok();
        console.warn.restore();
      });
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
