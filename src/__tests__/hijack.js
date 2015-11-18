import {describe, it} from 'mocha';
import assert from 'assert';
import {ResultTree} from '../graph';

const execute = require('graphql/execution/execute');
const originalExecute = execute.execute;

import {
  hijack,
  restore,
  emitter,
  processTree
} from '../hijack';


describe('hijack module', function () {
  it('should be able to hijack', function () {
    hijack();
    assert.notEqual(execute.execute, originalExecute);
  });

  it('should be able to restore', function () {
    restore();
    assert.equal(execute.execute, originalExecute);
  });

  describe('processTree', function () {
    it('should extract metrics and traces', function () {
      const tree = new ResultTree();
      const node = tree.root.addChild(
        {
          schemaName: 's1',
          typeName: 't1',
          fieldName: 'f1',
          nodeArguments: 'a0',
          nodeResult: 'r0',
          parentResult: 'p0',
        },
        {
          time: {total: 10, count: 1},
          count: {total: 1, count: 1}
        },
      );

      const child1 = node.addChild(
        {
          schemaName: 's1',
          typeName: 't2',
          fieldName: 'f2',
          nodeArguments: 'a00',
          nodeResult: 'r00',
          parentResult: 'p00',
        },
        {
          time: {total: 40, count: 2},
          count: {total: 2, count: 2}
        },
      );

      const child2 = node.addChild(
        {
          schemaName: 's1',
          typeName: 't2',
          fieldName: 'f2',
          nodeArguments: 'a01',
          nodeResult: 'r01',
          parentResult: 'p01',
        },
        {
          time: {total: 90, count: 3},
          count: {total: 2, count: 2}
        },
      );

      let resultMetrics;
      let resultTrace;
      emitter.once('metrics', metrics => resultMetrics = metrics);
      emitter.once('trace', trace => resultTrace = trace);
      processTree(tree);

      assert.deepEqual(resultMetrics, {
        's1.t1.f1': {
          time: {total: 10, count: 1},
          count: {total: 1, count: 1}
        },
        's1.t2.f2': {
          time: {total: 130, count: 5},
          count: {total: 4, count: 4}
        }
      });

      assert.deepEqual(resultTrace, {
        result: {
          name: 's1.t1.f1',
          args: 'a0',
          source: 'p0',
          result: 'r0',
          value: 10,
        },
        children: {
          [child1.id]: {
            result: {
              name: 's1.t2.f2',
              args: 'a00',
              result: 'r00',
              source: 'p00',
              value: 20,
            },
            children: {},
          },
          [child2.id]: {
            result: {
              name: 's1.t2.f2',
              args: 'a01',
              result: 'r01',
              source: 'p01',
              value: 30,
            },
            children: {},
          },
        },
      });
    });
  });
});
