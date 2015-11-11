import KadiraCore from 'kadira-core';
import {hijack, emitter} from './hijack';

// This will hold an instance of the KadiraCore class
// which will be used for authentication and transport.
export let kadira;

// Perform the initial handshake with the Kadira Server
// This functionr returns a promise and retries on fail.
// Data collection starts only after the connection.
export function connect(options) {
  kadira = new KadiraCore(options);
  return kadira.connect().then(() => {
    hijack();
    emitter.on('metrics', metrics => console.log('metrics:', metrics));
    emitter.on('traces', traces => console.log('traces:', traces));
  });
}

// DEBUG only function
// only used for tests
export function _hijack() {
  hijack();
  emitter.on('metrics', metrics => console.log('metrics:', metrics));
  emitter.on('traces', traces => console.log('traces:', traces));
}
