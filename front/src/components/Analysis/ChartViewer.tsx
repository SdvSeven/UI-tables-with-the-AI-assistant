import React from 'react';
import { useDataQuery } from '@hooks';

const ChartViewer: React.FC = () => {
  const { data } = useDataQuery();

  return (
    <div className="chart-viewer">
      <h4>Визуализация данных</h4>
      <p>Здесь будет график (требуется библиотека типа Recharts)</p>
      <pre>{JSON.stringify(data.slice(0, 10), null, 2)}</pre>
    </div>
  );
};

export default ChartViewer;