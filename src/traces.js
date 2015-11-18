export class TraceStore {
  constructor() {
    this.stores = {};
  }

  addTrace(trace) {
    const name = trace.name;
    let store = this.stores[name];
    if (!store) {
      store = new Store();
      this.stores[name] = store;
    }

    store.addTrace(trace);
  }

  getOutliers() {
    const outliers = [];
    for (const store of this.stores) {
      outliers.push(...store.getOutliers());
    }

    return outliers;
  }
}

// TODO pick outliers
export class Store {
  constructor() {
    this.traces = [];
  }

  addTrace(trace) {
    this.traces.push(trace);
  }

  getOutliers() {
    const outliers = this.traces;
    this.traces = [];
    return outliers;
  }
}
