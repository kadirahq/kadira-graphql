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
  const traces = createTrace(tree.root).children;
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

function createTrace(tree) {
  const trace = {
    name: formatMeta(tree.meta),
    metrics: tree.metrics,
    children: [],
  }

  for (var childName in tree.children) {
    if (tree.children.hasOwnProperty(childName)) {
      const child = tree.children[childName];
      trace.children.push(createTrace(child));
    }
  }

  return trace;
}
