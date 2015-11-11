import KadiraCore from 'kadira-core';
import {hijack, emitter} from './hijack';

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
    emitter.on('traces', sendTraces);
    setInterval(flushData, 10 * 1000);
  });
}

function collectMetrics(data) {
  for (var key in data) {
    if (!data.hasOwnProperty(key)) {
      continue;
    }

    if (!metrics[key]) {
      metrics[key] = data[key];
      continue;
    }

    metrics[key].total += data[key].total;
    metrics[key].count += data[key].count;
  }
}

function sendTraces(data) {
  kadira.addData('graphqlTraces', data);
}

function flushData() {
  kadira.addData('graphqlMetrics', metrics);
  metrics = {};
}
