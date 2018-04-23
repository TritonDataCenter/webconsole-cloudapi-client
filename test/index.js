'use strict';

const Assert = require('assert');
const Boom = require('boom');
const { expect } = require('code');
const Fs = require('fs');
const Lab = require('lab');
const { MockTracer } = require('opentracing');
const Path = require('path');
const TestDouble = require('testdouble');
const CloudApi = require('../');

const lab = exports.lab = Lab.script();
const { afterEach, describe, it } = lab;

const key = Fs.readFileSync(Path.join(__dirname, 'test.key'));
const keyId = '/boo/keys/test';

describe('CloudApi client', () => {
  describe('constructor tests', () => {
    it('blows up when no key provided', () => {
      try {
        const api = new CloudApi();
        expect(api).to.not.exist();
      } catch (e) {
        expect(e.message).to.equal('key is required');
      }
    });

    it('blows up when no logger provided', () => {
      try {
        const api = new CloudApi({
          key, keyId
        });
        expect(api).to.not.exist();
      } catch (e) {
        expect(e.message).to.equal('log is required');
      }
    });

    it('blows up when no token provided in production', () => {
      try {
        process.env.NODE_ENV = 'production';
        const api = new CloudApi({
          key, keyId, log: () => { }
        });
        expect(api).to.not.exist();
      } catch (e) {
        expect(e.message).to.equal('token is required for production');
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('does not blow up when token provided in production', () => {
      try {
        process.env.NODE_ENV = 'production';
        const api = new CloudApi({
          token: 'abc123', key, keyId, log: () => { }
        });
        expect(api).to.exist();
        expect(api._token).to.equal('abc123');
        expect(api._keyId).to.equal('/boo/keys/test');
        expect(api._wreck).to.exist();
        expect(api.fetch).to.be.a.function();
      } catch (e) {
        expect(e).to.not.exist();
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('does not blow up when no token provided in development', () => {
      try {
        process.env.NODE_ENV = 'development';
        const api = new CloudApi({
          key, keyId, log: () => { }
        });
        expect(api).to.exist();
      } catch (e) {
        expect(e).to.not.exist();
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('includes accept-version header', () => {
      const api = new CloudApi({
        key, keyId, log: () => { }
      });
      expect(api).to.exist();
      expect(api._wreck._defaults.headers).to.contain({'Accept-Version': '~8'});
    });
  });

  describe('fetch tests', () => {
    afterEach(() => {
      TestDouble.reset();
    });

    it('uses wreck to fetch data', async () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: {} });
      const results = await api.fetch('bacon');
      expect(results).to.equal({ test: 1 });
    });

    it('includes response', async () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: { status: 200 } });
      const results = await api.fetch('bacon', { includeRes: true });
      expect(results).to.equal({ payload: { test: 1 }, res: { status: 200 } });
    });

    it('/my is default pathPrefix', () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      expect(api._wreck._defaults.baseUrl).to.equal('http://localhost:5555/api/my');
    });

    it('can change pathPrefix', () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }, pathPrefix: '/test'
      });
      expect(api._wreck._defaults.baseUrl).to.equal('http://localhost:5555/api/test');
    });


    it('passes querystring data', async () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      const pathCaptor = TestDouble.matchers.captor();
      TestDouble.when(wreck(pathCaptor.capture(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: {} });
      const results = await api.fetch('bacon', { query: { strips: 2 } });
      expect(results).to.equal({ test: 1 });
      Assert(pathCaptor.value === 'bacon?strips=2');
    });

    it('defaults to GET', async () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: {} });
      const results = await api.fetch('/api');
      expect(results).to.equal({ test: 1 });
    });

    it('defaults to GET with a falsy HTTP method', async () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: {} });
      const results = await api.fetch('/api', { method: false });
      expect(results).to.equal({ test: 1 });
    });

    it('supports HEAD', async () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      const wreck = TestDouble.replace(api._wreck, 'request');
      TestDouble.when(wreck('head', TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ headers: { bacon: 'tasty' } });
      const { res } = await api.fetch('/api', { method: 'head', includeRes: true });
      expect(res.headers.bacon).to.equal('tasty');
    });

    it('supports POST', async () => {
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }
      });
      const wreck = TestDouble.replace(api._wreck, 'post');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: {} });
      const results = await api.fetch('bacon', { method: 'post' });
      expect(results).to.equal({ test: 1 });
    });

    it('logs error', async () => {
      const logs = [];
      const api = new CloudApi({
        url: 'http://localhost:5555/api',
        key,
        keyId,
        log: (parts, data) => {
          logs.push({ parts, data });
        }
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenReject(new Error('limp bacon is an abomination'));
      try {
        const results = await api.fetch('bacon', { query: { kind: 'limp' }, method: 'get' });
        expect(results).to.not.exist();
      } catch (err) {
        expect(err).to.exist();
        expect(logs.length).to.equal(1);
        expect(logs[0].parts).to.contain('bacon?kind=limp');
        expect(logs[0].data.message).to.contain('limp bacon is an abomination');
      }
    });

    it('returns default on error', async () => {
      const api = new CloudApi({ url: 'http://localhost:5555/api', key, keyId, log: () => { } });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenReject(new Error('limp bacon is an abomination'));
      try {
        const results = await api.fetch('bacon', {
          query: { kind: 'limp' },
          default: 'no bacon for you'
        });
        expect(results).to.contain('no bacon for you');
      } catch (err) {
        expect(err).to.not.exist();
      }
    });

    it('returns payload and message on error', async () => {
      const api = new CloudApi({ url: 'http://localhost:5555/api', key, keyId, log: () => { } });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenReject(Boom.badRequest('no bacon for you', { payload: { message: 'bacon cannot be limp' } }));
      try {
        const results = await api.fetch('bacon', {
          query: { kind: 'limp' }
        });
        expect(results).to.not.exist();
      } catch (err) {
        expect(err).to.exist();
        expect(err.output.payload).to.contain({ statusCode: 400, error: 'Bad Request', message: 'bacon cannot be limp' });
      }
    });

    it('returns only the error message on error when no payload exists', async () => {
      const api = new CloudApi({ url: 'http://localhost:5555/api', key, keyId, log: () => { } });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenReject(Boom.badRequest('no bacon for you', { payload: '' }));
      try {
        const results = await api.fetch('bacon', {
          query: { kind: 'limp' }
        });
        expect(results).to.not.exist();
      } catch (err) {
        expect(err).to.exist();
        expect(err.output.payload).to.contain({ statusCode: 400, error: 'Bad Request' });
      }
    });

    it('creates span for request', async () => {
      const tracer = new MockTracer();
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }, tracer
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: { status: 200 } });
      const results = await api.fetch('bacon', { includeRes: true });
      expect(results).to.equal({ payload: { test: 1 }, res: { status: 200 } });
      expect(tracer.report().spans[0]._operationName).to.equal('get bacon');
    });

    it('creates child span for request when provided with a parent span', async () => {
      const tracer = new MockTracer();
      const span = tracer.startSpan('parent');
      const api = new CloudApi({
        url: 'http://localhost:5555/api', key, keyId, log: () => { }, tracer
      });
      const wreck = TestDouble.replace(api._wreck, 'get');
      TestDouble.when(wreck(TestDouble.matchers.anything(), TestDouble.matchers.anything()))
        .thenResolve({ payload: { test: 1 }, res: { status: 200 } });
      const results = await api.fetch('bacon', { includeRes: true, span });
      expect(results).to.equal({ payload: { test: 1 }, res: { status: 200 } });
      span.finish();
      expect(tracer.report().spans[0]._operationName).to.equal('parent');
      expect(tracer.report().spans[1]._operationName).to.equal('get bacon');
    });
  });
});
