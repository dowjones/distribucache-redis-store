var stub = require('sinon').stub,
  ExpiryListener = require('../src/ExpiryListener'),
  should = require('should');

describe('ExpiryListener', function () {
  var unit, client;

  beforeEach(function () {
    function noop() {}
    client = stub({
      config: noop, on: noop,
      psubscribe: noop, punsubscribe: noop
    });
    unit = new ExpiryListener(client, {keyspace: 'nsp:*:trigger'});
  });

  it('should throw an invalidate error if no keyspace provided', function () {
    var listener;
    (function () {
      listener = new ExpiryListener(client, {});
    }).should.throw(/keyspace/);
    (function () {
      listener = new ExpiryListener(client);
    }).should.throw(/keyspace/);
    should(listener).not.be.ok();
  });

  describe('listen', function () {
    it('should subscribe to message', function () {
      unit.listen();
      client.psubscribe.calledOnce.should.be.ok();
      client.on.calledOnce.should.be.ok();
    });

    it('should call _onExpiry on expiry event', function (done) {
      unit.listen();
      unit.on('expired', function (key) {
        key.should.equal('s:g:a');
        done();
      });
      client.on.lastCall.args[1]('__keyspace@0__:nsp:*:trigger',
        '__keyspace@0__:nsp:s:g:a:trigger', 'expired');
    });

    it('should work with buffers if in that mode', function (done) {
      unit.listen();
      unit.on('expired', function (key) {
        key.should.equal('s:g:a');
        done();
      });
      client.on.lastCall.args[1]('__keyspace@0__:nsp:*:trigger',
        '__keyspace@0__:nsp:s:g:a:trigger', new Buffer('expired'));
    });

    it('should not emit an expired event if message not "expired"', function () {
      unit.listen();
      unit.on('expired', function () {
        throw new Error('called expired');
      });
      client.on.lastCall.args[1]('__keyspace@0__:k', 'a:b', 'del');
    });

    it('should not emit an expired event if wrong channel', function () {
      unit.listen();
      unit.on('expired', function () {
        throw new Error('called expired');
      });
      client.on.lastCall.args[1]('__keyspace@0__:z', '', '');
    });
  });

  describe('stopListening', function () {
    it('should send an unsubscribe and emit a stop', function (done) {
      unit.on('stop', done);
      client.punsubscribe.yields(null);
      unit.stopListening();
    });

    it('should emit an error on unsubscribe error', function (done) {
      unit.on('error', function (err) {
        err.message.should.equal('bad');
        done();
      });
      client.punsubscribe.yields(new Error('bad'));
      unit.stopListening();
    });
  });
});
