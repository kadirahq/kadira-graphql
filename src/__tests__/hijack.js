import {describe, it} from 'mocha';
import assert from 'assert';

const execute = require('graphql/execution/execute');
const originalExecute = execute.execute;

import {
  hijack,
  restore,
  emitter,
  ResultNode,
  ResultTree,
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

  describe('ResultNode', function () {
    it('should init with unique ids', function () {
      const uniqueIds = {};
      for (let i = 0; i < 1000; ++i) {
        const node = new ResultNode();
        uniqueIds[node.id] = true;
      }
      const count = Object.keys(uniqueIds).length;
      assert.equal(count, 1000);
    });

    it('should return computed name', function () {
      const meta = {schemaName: 's1', typeName: 't1', fieldName: 'f1'};
      const node = new ResultNode(null, meta);
      assert.equal(node.name, 's1.t1.f1');
    });

    describe('addChild', function () {
      it('should add child to parent', function () {
        const tree = {_all: {}};
        const parent = new ResultNode(tree);
        const child = parent.addChild('meta', 'metrics');
        assert.equal(parent.children[child.id], child);
        assert.equal(child.parent, parent);
      });

      it('should add child to the tree', function () {
        const tree = {_all: {}};
        const parent = new ResultNode(tree);
        const child = parent.addChild('meta', 'metrics');
        assert.equal(tree._all[child.id], child);
      });
    });

    describe('mapTree', function () {
      it('should map with tree layout', function () {
        const tree = {_all: {}};
        const root = new ResultNode(tree);
        const l0c0 = root.addChild();
        const l0c1 = root.addChild();
        const l1c0 = l0c1.addChild();
        const nodes = [];

        const result = root.mapTree(node => {
          nodes.push(node.id);
          return node.id;
        });

        assert.deepEqual(result, {
          result: root.id,
          children: {
            [l0c0.id]: {result: l0c0.id, children: {}},
            [l0c1.id]: {
              result: l0c1.id,
              children: {
                [l1c0.id]: {result: l1c0.id, children: {}},
              },
            },
          },
        });
      });
    });
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
