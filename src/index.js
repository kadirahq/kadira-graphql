import KadiraCore from 'kadira-core';
import {hijack, emitter} from './hijack';
import {TraceStore} from './traces';

// This will hold an instance of the KadiraCore class
// which will be used for authentication and transport.
export let kadira;

// collect metrics
let metrics = {};

// store traces & pick outliers
const traces = new TraceStore();

// Perform the initial handshake with the Kadira Server
// This functionr returns a promise and retries on fail.
// Data collection starts only after the connection.
export function connect(options) {
  kadira = new KadiraCore(options);
  return kadira.connect().then(() => {
    hijack();
    emitter.on('metrics', collectMetrics);
    emitter.on('trace', collectTrace);
    setInterval(flushData, 10000);
  });
}

function collectMetrics(data) {
  for (const key in data) {
    if (!data.hasOwnProperty(key)) {
      continue;
    }

    if (!metrics[key]) {
      metrics[key] = data[key];
      continue;
    }

    for (const name in data[key]) {
      if (!data[key].hasOwnProperty(name)) {
        metrics[key][name] = data[key][name];
        continue;
      }

      metrics[key][name].total += data[key][name].total;
      metrics[key][name].count += data[key][name].count;
    }
  }
}

function collectTrace(trace) {
  traces.addTrace(trace);
}

function flushData() {
  flushMetrics();
  flushTraces();
}

function flushMetrics() {
  if (!Object.keys(metrics).length) {
    return;
  }

  const startTime = Date.now();
  const graphNodes = {};
  for (const key in metrics) {
    if (!metrics.hasOwnProperty(key)) {
      continue;
    }

    graphNodes[key] = {};
    for (const name in metrics[key]) {
      if (!metrics[key].hasOwnProperty(name)) {
        continue;
      }

      graphNodes[key][name] = metrics[key][name];
    }
  }

  kadira.addData('graphqlMetrics', {startTime, graphNodes});
  metrics = {};
}

function flushTraces() {
  const startTime = Date.now();
  const graphTraces = traces.getOutliers();
  kadira.addData('graphqlTraces', {startTime, graphTraces});
}
