import {describe, it} from 'mocha';
import assert from 'assert';

import {
  ResultNode,
  ResultTree,
  walkTheTree
} from '../hijack';

describe('hijack module', function () {
  it('should be able to hijack');
  it('should be able to restore');

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
          time: {total: 0, count: 1},
          count: {total: 1, count: 1}
        },
      );

      node.addChild(
        {
          schemaName: 's1',
          typeName: 't2',
          fieldName: 'f2',
          nodeArguments: 'a00',
          nodeResult: 'r00',
          parentResult: 'p00',
        },
        {
          time: {total: 0, count: 2},
          count: {total: 2, count: 2}
        },
      );

      node.addChild(
        {
          schemaName: 's1',
          typeName: 't2',
          fieldName: 'f2',
          nodeArguments: 'a01',
          nodeResult: 'r01',
          parentResult: 'p01',
        },
        {
          time: {total: 0, count: 3},
          count: {total: 2, count: 2}
        },
      );

      const result = walkTheTree(node);

      assert.deepEqual(result.metrics, {
        's1.t1.f1': {
          time: {total: 0, count: 1},
          count: {total: 1, count: 1}
        },
        's1.t2.f2': {
          time: {total: 0, count: 5},
          count: {total: 4, count: 4}
        }
      });

      assert.deepEqual(result.trace, {
        name: 's1.t1.f1',
        args: 'a0',
        source: 'p0',
        result: 'r0',
        value: {total: 0, count: 1},
        children: [
          {
            name: 's1.t2.f2',
            args: 'a00',
            result: 'r00',
            source: 'p00',
            value: {total: 0, count: 2},
            children: []
          },
          {
            name: 's1.t2.f2',
            args: 'a01',
            result: 'r01',
            source: 'p01',
            value: {total: 0, count: 3},
            children: []
          }
        ]
      });

    });
  });
});
