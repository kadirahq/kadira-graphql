import {EventEmitter} from 'events';
const execute = require('graphql/execution/execute');
const originalExecute = execute.execute;

// create unique ids
let NEXT_SCHEMA_ID = 0;
let NEXT_NODE_ID = 0;

// emitter sends recorded information.
// emits 'metric' and 'trace' events.
export const emitter = new EventEmitter();

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
}

// Hijack the execute function
export function hijack() {
  execute.execute = hijackedExecute;
}

// Restore te execute function
export function restore() {
  execute.execute = originalExecute;
}

// Hijacked version of the graphql execute function
// Instrument the schema before resolving the query.
// args: schema, ast, root, vars, opname
function hijackedExecute(schema, ast, root, vars, opname) {
  if (!schema.__kadiraIntrumented) {
    instrumentSchema(schema);
    schema.__kadiraIntrumented = true;
  }

  // wrap the root value to add tree info.
  const tree = new ResultTree(root);
  const out = originalExecute.call(this, schema, ast, tree, vars, opname);
  // Use `Promise.resolve` on execute result which may or may not
  // be a promise. Resolve the promise and process collected data.
  return Promise.resolve(out).then(function (result) {
    processTree(tree);
    return result;
  });
}

// Instrument the schema to track graph processing times.
// This is called when the schema is used for the first time.
function instrumentSchema(schema) {
  // TODO get the real schema name from the user.
  const schemaName = 'Schema:' + (++NEXT_SCHEMA_ID);

  const types = schema.getTypeMap();
  for (const typeName in types) {
    if (!types.hasOwnProperty(typeName)) {
      continue;
    }

    const type = types[typeName];
    if (!type.getFields) {
      continue;
    }

    const fields = type.getFields();
    for (const fieldName in fields) {
      if (!fields.hasOwnProperty(fieldName)) {
        continue;
      }

      const field = fields[fieldName];
      if (!field.resolve) {
        continue;
      }

      hijackResolve(field, schemaName, typeName, fieldName);
    }
  }
}

// hijacks the resolve function for a field identified by names.
function hijackResolve(field, schemaName, typeName, fieldName) {
  const originalResolve = field.resolve;

  // NOTE `source` will be a `ResultTree` object when it's the
  // root value. `source.data` will have the original value.
  field.resolve = function (_source, args, info) {
    let source = _source;
    let parent = _source.__kadiraData;
    if (_source instanceof ResultTree) {
      source = _source.data;
      parent = _source.root;
    }

    const before = Date.now();
    const output = originalResolve.call(this, source, args, info);

    return Promise.resolve(output).then(function (data) {
      const millis = Date.now() - before;
      const metrics = {
        nodeResolveTime: {total: millis, count: 1},
        nodeResolveCount: {total: 1, count: 1},
      };

      const meta = {
        schemaName,
        typeName,
        fieldName,
        nodeArguments: args,
        nodeResult: data,
        parentResult: source,
      };

      function wrap(item) {
        try {
          // Sometimes, resolved results do not allow setting a `__kadiraData`
          // field. Catch that error and stop collecting for those results.
          const node = parent.addChild(meta, metrics);
          item.__kadiraData = node;
        } catch (e) {
          // TODO check the error and selectively ignore them
          // Throw all other errors for now (while still alpha).
          // Log and ignore errors before releasing to users.
        }
      }

      if (Array.isArray(data)) {
        data.forEach(wrap);
      } else {
        wrap(data);
      }

      return data;
    });
  };
}

export function processTree(tree) {
  for (var key in tree.root.children) {
    if (tree.root.children.hasOwnProperty(key)) {
      const node = tree.root.children[key];
      const result = walkTheTree(node);
      emitter.emit('metrics', result.metrics);
      emitter.emit('traces', result.trace);
    }
  }
}

export function walkTheTree(tree, metrics = {}) {
  const name = tree.name;

  let nodeMetrics = metrics[name];
  if (nodeMetrics) {
    mergeMetrics(nodeMetrics, tree.metrics);
  } else {
    const clone = cloneMetrics(tree.metrics);
    nodeMetrics = metrics[name] = clone;
  }

  const children = [];
  for (var childName in tree.children) {
    if (tree.children.hasOwnProperty(childName)) {
      const child = tree.children[childName];
      const result = walkTheTree(child, metrics);
      children.push(result.trace);
    }
  }

  let value = 0;
  if (tree.metrics.time) {
    const time = tree.metrics.time;
    value = (time.total / time.count) || 0;
  }

  const trace = {
    name,
    value,
    children,
    args: tree.meta.nodeArguments,
    source: tree.meta.parentResult,
    result: tree.meta.nodeResult,
  };

  return {metrics, trace};
}

function cloneMetrics(metrics) {
  // TODO: find the fastest method to clone
  return JSON.parse(JSON.stringify(metrics));
}

function mergeMetrics(existing, current) {
  for (var key in current) {
    if (!current.hasOwnProperty(key)) {
      continue;
    }

    if (!existing[key]) {
      existing[key] = current[key];
      continue;
    }

    existing[key].total += current[key].total;
    existing[key].count += current[key].count;
  }
}
