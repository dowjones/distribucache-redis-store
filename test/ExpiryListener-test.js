import {stub} from 'sinon';
import ExpiryListener from '../src/ExpiryListener';
import should from 'should';

describe('ExpiryListener', () => {
  var unit, client;

  beforeEach(() => {
    function noop() {}
    client = stub({
      config: noop, on: noop,
      psubscribe: noop, punsubscribe: noop
    });
    unit = new ExpiryListener(client, {
      keyspace: 'nsp:*:trigger'
    });
  });

  it('should throw an invalidate error if no keyspace provided', () => {
    var listener;
    (() => {
      listener = new ExpiryListener(client, {});
    }).should.throw(/keyspace/);
    (() => {
      listener = new ExpiryListener(client);
    }).should.throw(/keyspace/);
    should(listener).not.be.ok();
  });

  describe('listen', () => {
    it('should subscribe to message', () => {
      unit.listen();
      client.psubscribe.calledOnce.should.be.ok();
      client.on.calledOnce.should.be.ok();
    });

    it('should call _onExpiry on expiry event', done => {
      unit.listen();
      unit.on('expired', key => {
        key.should.equal('s:g:a');
        done();
      });
      client.on.lastCall.args[1]('__keyspace@0__:nsp:*:trigger',
        '__keyspace@0__:nsp:s:g:a:trigger', 'expired');
    });

    it('should work with buffers if in that mode', done => {
      unit.listen();
      unit.on('expired', key => {
        key.should.equal('s:g:a');
        done();
      });
      client.on.lastCall.args[1]('__keyspace@0__:nsp:*:trigger',
        '__keyspace@0__:nsp:s:g:a:trigger', new Buffer('expired'));
    });

    it('should not emit an expired event if message not "expired"', () => {
      unit.listen();
      unit.on('expired', () => {
        throw new Error('called expired');
      });
      client.on.lastCall.args[1]('__keyspace@0__:k', 'a:b', 'del');
    });

    it('should not emit an expired event if wrong channel', () => {
      unit.listen();
      unit.on('expired', () => {
        throw new Error('called expired');
      });
      client.on.lastCall.args[1]('__keyspace@0__:z', '', '');
    });
  });

  describe('stopListening', () => {
    it('should send an unsubscribe and emit a stop', done => {
      unit.on('stop', done);
      client.punsubscribe.yields(null);
      unit.stopListening();
    });

    it('should emit an error on unsubscribe error', done => {
      unit.on('error', err => {
        err.message.should.equal('bad');
        done();
      });
      client.punsubscribe.yields(new Error('bad'));
      unit.stopListening();
    });
  });
});
