const METRICS = {
  'graphql-node-resolve-time': {format: avg},
  'graphql-node-resolve-count': {format: sum},
};

export function format(type, metric) {
  return METRICS[type].format(metric);
}

function sum(metric) {
  return metric.total;
}

function avg(metric) {
  return metric.total / metric.count;
}
