import {describe, it} from 'mocha';
import assert from 'assert';

import {
  ResultNode,
  ResultTree,
} from '../graph';

describe('graph module', function () {
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

    describe('getName', function () {
      it('should return computed name', function () {
        const meta = {schemaName: 's1', typeName: 't1', fieldName: 'f1'};
        const node = new ResultNode(null, meta);
        assert.equal(node.getName(), 's1.t1.f1');
      });
    });

    describe('getPath', function () {
      it('should return the lineage', function () {
        function getMetadata(n) {
          return {
            schemaName: 's' + n,
            typeName: 't' + n,
            fieldName: 'f' + n,
            nodeArguments: 'a' + n,
          };
        }

        function getMetrics(n) {
          return {time: {total: n, count: 1}};
        }

        const tree = new ResultTree();
        const n0 = new ResultNode(tree, getMetadata(0), getMetrics(0));
        const n1 = n0.addChild(getMetadata(1), getMetrics(1));
        const n2 = n1.addChild(getMetadata(2), getMetrics(2));
        assert.deepEqual(n2.getPath(), [
          {time: 0, name: 's0.t0.f0', args: 'a0'},
          {time: 1, name: 's1.t1.f1', args: 'a1'},
        ]);
      });
    });

    describe('getTime', function () {
      it('should return the time', function () {
        const tree = new ResultTree();
        const metrics = {time: {total: 100, count: 2}};
        const node = new ResultNode(tree, {}, metrics);
        assert.equal(node.getTime(), 50);
      });
    });

    describe('getTrace', function () {
      it('should return the trace', function () {
        function getMetadata(n) {
          return {
            schemaName: 's' + n,
            typeName: 't' + n,
            fieldName: 'f' + n,
            nodeArguments: 'a' + n,
            parentResult: 'p' + n,
            nodeResult: 'r' + n,
          };
        }

        function getMetrics(n) {
          return {time: {total: n, count: 1}};
        }

        const tree = new ResultTree();
        const n0 = new ResultNode(tree, getMetadata(0), getMetrics(0));
        const n1 = n0.addChild(getMetadata(1), getMetrics(1));
        const n2 = n1.addChild(getMetadata(2), getMetrics(2));
        assert.deepEqual(n2.getTrace(), {
          name: n2.getName(),
          path: n2.getPath(),
          time: n2.getTime(),
          args: n2.meta.nodeArguments,
          source: n2.meta.parentResult,
          result: n2.meta.nodeResult,
        });
      });
    });

    describe('addChild', function () {
      it('should add child to parent', function () {
        const tree = new ResultTree();
        const parent = new ResultNode(tree);
        const child = parent.addChild('meta', 'metrics');
        assert.equal(parent.children[child.id], child);
        assert.equal(child.parent, parent);
      });

      it('should add child to the tree', function () {
        const tree = new ResultTree();
        const parent = new ResultNode(tree);
        const child = parent.addChild('meta', 'metrics');
        assert.equal(tree._all[child.id], child);
      });
    });

    describe('mapTree', function () {
      it('should map with tree layout', function () {
        const tree = new ResultTree();
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
});
