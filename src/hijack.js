import {EventEmitter} from 'events';
import {ResultTree} from './graph';

const execute = require('graphql/execution/execute');
const originalExecute = execute.execute;

const Instrumented = Symbol();
const KadiraData = Symbol();

// create unique ids
let NEXT_SCHEMA_ID = 0;

// Hijack the execute function
export function hijack() {
  execute.execute = hijackedExecute;
}

// Restore te execute function
export function restore() {
  execute.execute = originalExecute;
}

// emitter sends recorded information.
// emits 'metric' and 'trace' events.
export const emitter = new EventEmitter();

// Hijacked version of the graphql execute function
// Instrument the schema before resolving the query.
// args: schema, ast, root, vars, opname
function hijackedExecute(schema, ast, root, vars, opname) {
  if (!schema[Instrumented]) {
    instrumentSchema(schema);
    schema[Instrumented] = true;
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
    let parent = _source[KadiraData];
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
          // Sometimes, resolved results do not allow setting a `KadiraData`
          // field. Catch that error and stop collecting for those results.
          const node = parent.addChild(meta, metrics);
          item[KadiraData] = node;
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
  for (const key in tree.root.children) {
    if (!tree.root.children.hasOwnProperty(key)) {
      continue;
    }

    const rootNode = tree.root.children[key];
    const metrics = {};

    rootNode.mapTree(node => {
      let nodeMetrics = metrics[node.getName()];
      if (nodeMetrics) {
        mergeMetrics(nodeMetrics, node.metrics);
      } else {
        const clone = cloneMetrics(node.metrics);
        nodeMetrics = metrics[node.getName()] = clone;
      }

      emitter.emit('trace', node.getTrace());
    });

    emitter.emit('metrics', metrics);
  }
}

function cloneMetrics(metrics) {
  // TODO: find the fastest method to clone
  return JSON.parse(JSON.stringify(metrics));
}

function mergeMetrics(existing, current) {
  for (const key in current) {
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
