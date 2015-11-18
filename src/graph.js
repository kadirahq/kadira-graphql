// create unique ids
let NEXT_NODE_ID = 0;

// Resolved values will be wrapped with this special Value class
// in order to attach additional metadata without affecting the
// original result item in any way.
export class ResultNode {
  constructor(tree, meta, metrics) {
    this.id = NEXT_NODE_ID++;
    this.tree = tree;
    this.meta = meta;
    this.metrics = metrics;
    this.parent = null;
    this.children = {};
  }

  get name() {
    if (!this.meta) {
      return '';
    }

    return this.meta.schemaName +
      '.' + this.meta.typeName +
      '.' + this.meta.fieldName;
  }

  addChild(meta, metrics) {
    const node = new ResultNode(this.tree, meta, metrics);
    node.parent = this;
    this.children[node.id] = node;
    node.tree._all[node.id] = node;
    return node;
  }

  mapTree(fn) {
    const result = fn(this);
    const children = {};

    for (var name in this.children) {
      if (this.children.hasOwnProperty(name)) {
        const child = this.children[name];
        children[name] = child.mapTree(fn);
      }
    }

    return {result, children};
  }
}

// ResultNode objects are grouped into a result tree.
// It also contains a map of all nodes in the tree.
// Root value is available in the `data` field.
export class ResultTree {
  constructor(data) {
    // this._all collects all nodes
    // in all levels under this tree
    this._all = {};
    // this.data holds the original
    // root value (if given by user)
    this.data = data;
    // this.root does not have any
    // data. Holds trees in children.
    this.root = new ResultNode(this);
  }

  mapTree(fn) {
    return this.root.mapTree(fn);
  }
}
