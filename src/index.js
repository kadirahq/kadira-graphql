import KadiraCore from 'kadira-core';
import {hijack} from './hijack';

// This will hold an instance of the KadiraCore class
// which will be used for authentication and transport.
export let kadira;

// Perform the initial handshake with the Kadira Server
// This functionr returns a promise and retries on fail.
// Data collection starts only after the connection.
export function connect(options) {
  kadira = new KadiraCore(options);
  return kadira.connect().then(() => {
    hijack(processTree);
  });
}

function processTree(tree) {
  // TODO collect graph metrics with meta data.
  const result = walkTheTree(tree.root);
  const metrics = result.metrics;
  const traces = result.trace.children;
  console.log('! metrics:', JSON.stringify(metrics, null, 2));
  console.log('! traces:', JSON.stringify(traces, null, 2));
}

function formatMeta(meta) {
  if (!meta) {
    return '';
  }

  return meta.schemaName +
    '.' + meta.typeName +
    '.' + meta.fieldName;
}

function walkTheTree(tree, allMetrics = {}) {
  const name = formatMeta(tree.meta);
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

  const trace = {name, metrics, children: []};
  return {metrics: allMetrics, trace};
}
