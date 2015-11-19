import {describe, it} from 'mocha';
import assert from 'assert';

import {
  TraceStore,
  Store,
} from '../traces';

describe('traces module', function () {
  describe('TraceStore', function () {
    describe('addTrace', function () {
      it('should add the trace to a store', function () {
        const store = new TraceStore();

        let added;
        store.stores.a = {
          addTrace(t) { added = t; }
        };

        const trace = {name: 'a'};
        store.addTrace(trace);
        assert.equal(added, trace);
      });
    });

    describe('getOutliers', function () {
      it('should collect from all stores', function () {
        const store = new TraceStore();
        store.stores.a = { getOutliers() { return [ 'a1', 'a2' ]; } };
        store.stores.b = { getOutliers() { return [ 'b1', 'b2' ]; } };
        const result = store.getOutliers();
        assert.deepEqual(result, [ 'a1', 'a2', 'b1', 'b2' ]);
      });
    });
  });

  describe('Store', function () {
    describe('addTrace', function () {
      it('should set if maximum is null', function () {
        const store = new Store();
        const trace = {time: 10};
        assert.equal(store.maximum, null);
        store.addTrace(trace);
        assert.equal(store.maximum, trace);
      });

      it('should set if new value is larger', function () {
        const store = new Store();
        const trace1 = {time: 10};
        const trace2 = {time: 20};
        store.addTrace(trace1);
        assert.equal(store.maximum, trace1);
        store.addTrace(trace2);
        assert.equal(store.maximum, trace2);
      });

      it('should not set if value is smaller', function () {
        const store = new Store();
        const trace1 = {time: 10};
        const trace2 = {time: 5};
        store.addTrace(trace1);
        assert.equal(store.maximum, trace1);
        store.addTrace(trace2);
        assert.equal(store.maximum, trace1);
      });
    });

    describe('getOutliers', function () {
      it('should increment the counter', function () {
        const store = new Store();
        assert.equal(store.counter, 0);
        store.getOutliers();
        assert.equal(store.counter, 1);
      });

      it('should return empty if no maximum', function () {
        const store = new Store();
        const result = store.getOutliers();
        assert.deepEqual(result, []);
      });

      it('should return max if it is an outlier', function () {
        const store = new Store();
        store.archive = [ 11, 10, 12 ];
        const trace = {time: 100};
        store.addTrace(trace);
        const result = store.getOutliers();
        assert.deepEqual(result, [ trace ]);
      });

      it('should return empty if not an outlier', function () {
        const store = new Store();
        store.archive = [ 11, 10, 12 ];
        const trace = {time: 13};
        store.addTrace(trace);
        const result = store.getOutliers();
        assert.deepEqual(result, []);
      });

      it('should return max every N times', function () {
        const store = new Store();
        store.counter = store.options.forceEvery - 1;
        store.archive = [ 11, 10, 12 ];
        const trace = {time: 13};
        store.addTrace(trace);
        const result = store.getOutliers();
        assert.deepEqual(result, [ trace ]);
      });
    });
  });
});
