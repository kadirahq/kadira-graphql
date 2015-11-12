import KadiraCore from 'kadira-core';
import {hijack, emitter} from './hijack';
import {format} from './metrics';

// This will hold an instance of the KadiraCore class
// which will be used for authentication and transport.
export let kadira;

// collect metrics
let metrics = {};

// Perform the initial handshake with the Kadira Server
// This functionr returns a promise and retries on fail.
// Data collection starts only after the connection.
export function connect(options) {
  kadira = new KadiraCore(options);
  return kadira.connect().then(() => {
    hijack();
    emitter.on('metrics', collectMetrics);
    emitter.on('traces', collectTraces);
    setInterval(flushData, 10 * 1000);
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

function collectTraces(data) {
  // TODO format the trace first (clean it).
  // kadira.addData('graphqlTraces', data);
}

function flushData() {
  if (!Object.keys(metrics).length) {
    return;
  }

  const formatted = {};
  for (const key in metrics) {
    if (!metrics.hasOwnProperty(key)) {
      continue;
    }

    formatted[key] = {};
    for (const name in metrics[key]) {
      if (!metrics[key].hasOwnProperty(name)) {
        continue;
      }

      formatted[key][name] = format(name, metrics[key][name]);
    }
  }

  kadira.addData('graphqlMetrics', formatted);
  metrics = {};
}
