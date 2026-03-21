export const createWorker = () => {
  const workerCode = `
    self.addEventListener('message', (e) => {
      const { type, data, operation } = e.data;
      if (type === 'aggregate') {
        const result = performAggregation(data, operation);
        self.postMessage({ type: 'aggregate-result', data: result });
      }
      function performAggregation(data, op) {
        // заглушка
        return data;
      }
    });
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

export default createWorker;