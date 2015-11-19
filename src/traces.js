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
    for (var name in this.stores) {
      if (!this.stores.hasOwnProperty(name)) {
        continue;
      }

      const store = this.stores[name];
      outliers.push(...store.getOutliers());
    }

    return outliers;
  }
}

// TODO get options
export class Store {
  constructor() {
    this.options = {
      forceEvery: 30,
      archiveSize: 30,
      maxMADZ: 3,
    };

    this.counter = 0;
    this.maximum = null;
    this.archive = [];
  }

  addTrace(trace) {
    if (!this.maximum || this.maximum.time < trace.time) {
      this.maximum = trace;
    }
  }

  getOutliers() {
    const result = [];
    this.counter++;

    if (!this.maximum) {
      return result;
    }

    const isPeriodic = (this.counter % this.options.forceEvery === 0);
    const isOutlier = this.isOutlier(this.maximum.time);

    if (isPeriodic || isOutlier) {
      this.addToArchive(this.maximum);
      result.push(this.maximum);
    }

    this.maximum = null;
    return result;
  }

  addToArchive(trace) {
    this.archive.push(trace);
    if (this.archive.length > this.options.archiveSize) {
      const start = this.archive.length - this.options.archiveSize;
      this.archive.splice(start, this.options.archiveSize);
    }
  }

  isOutlier(val) {
    if (!this.archive.length) {
      return true;
    }

    // create function to claculate median deviation
    const median = calculateMedian(this.archive);
    const mdFunc = x => Math.abs(median - x);

    // calculate median absolute deviation Z value
    const mad = calculateMAD(this.archive, mdFunc);
    const madZ = mdFunc(val) / mad;

    return madZ > this.options.maxMADZ;
  }
}


function calculateMedian(list) {
  const sorted = list.slice();
  sorted.sort(function (a, b) { return a - b; });

  if (sorted.length % 2 === 1) {
    const position = (sorted.length + 1) / 2;
    return sorted[position];
  }

  const pos1 = sorted.length / 2;
  const pos2 = pos1 + 1;
  return (sorted[pos1] + sorted[pos2]) / 2;
}

function calculateMAD(list, mdFunc) {
  const medianDeviations = list.map(mdFunc);
  return calculateMedian(medianDeviations);
}
