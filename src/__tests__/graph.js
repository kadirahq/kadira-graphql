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
