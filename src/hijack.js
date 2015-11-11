import {EventEmitter} from 'events';
const execute = require('graphql/execution/execute');
const originalExecute = execute.execute;

// create unique ids
let NEXT_SCHEMA_ID = 0;
let NEXT_NODE_ID = 0;

// emitter sends recorded information.
// emits 'metric' and 'trace' events.
export const emitter = new EventEmitter();

// ResultNode objects are grouped into a result tree.
// It also contains a map of all nodes in the tree.
// Root value is available in the `data` field.
class ResultTree {
  constructor(data) {
    this._all = {};
    this.data = data;
    this.root = new ResultNode(this);
  }
}

// Resolved values will be wrapped with this special Value class
// in order to attach additional metadata without affecting the
// original result item in any way.
class ResultNode {
  constructor(tree, meta, metrics) {
    this.id = NEXT_NODE_ID++;
    this.tree = tree;
    this.meta = meta;
    this.metrics = metrics;
    this.parent = null;
    this.children = {};
  }

  addChild(meta, metrics) {
    const node = new ResultNode(this.tree, meta, metrics);
    node.parent = this;
    this.children[node.id] = node;
    node.tree._all[node.id] = node;
    return node;
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
        'graphql-node-resolve-time': {total: millis, count: 1},
        'graphql-node-resolve-count': {total: 1, count: 1},
      };

      const meta = {
        schemaName,
        typeName,
        fieldName,
        nodeResult: data,
        nodeArguments: args,
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

function processTree(tree) {
  for (var key in tree.root.children) {
    if (tree.root.children.hasOwnProperty(key)) {
      const node = tree.root.children[key];
      const result = walkTheTree(node);
      emitter.emit('metrics', result.metrics);
      emitter.emit('traces', result.trace);
    }
  }
}

function walkTheTree(tree, allMetrics = {}) {
  let name = '';
  if (tree.meta) {
    name = tree.meta.schemaName +
      '.' + tree.meta.typeName +
      '.' + tree.meta.fieldName;
  }

  let metrics = allMetrics[name];
  if (!metrics) {
    metrics = allMetrics[name] = tree.metrics;
  } else {
    for (var key in tree.metrics) {
      if (tree.metrics.hasOwnProperty(key)) {
        metrics[key].total += tree.metrics[key].total;
        metrics[key].count += tree.metrics[key].count;
      }
    }
  }

  const children = [];
  for (var childName in tree.children) {
    if (tree.children.hasOwnProperty(childName)) {
      const child = tree.children[childName];
      const result = walkTheTree(child, allMetrics);
      children.push(result.trace);
    }
  }

  const trace = {name, metrics, children};
  return {metrics: allMetrics, trace};
}
