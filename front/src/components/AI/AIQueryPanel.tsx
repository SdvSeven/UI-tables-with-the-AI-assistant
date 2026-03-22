import React, { useState } from 'react';
import { api } from '@services';

const AIQueryPanel: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const data = await api.sendNaturalLanguageQuery(question);
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({ error: 'Ошибка при обращении к AI' });
    } finally {
      setLoading(false);
    }
  };

  const renderData = (rows: any[]) => {
    if (!rows || rows.length === 0) return <p>Нет данных</p>;
    const columns = Object.keys(rows[0]);
    return (
      <table className="ai-result-table">
        <thead>
          <tr>
            {columns.map(col => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map(col => <td key={col}>{String(row[col])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="ai-query-panel">
      <h3>Задать вопрос по данным</h3>
      <div className="query-input">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Например: Покажи продажи по Москве"
          disabled={loading}
        />
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Загрузка...' : 'Спросить'}
        </button>
      </div>
      {result && (
        <div className="ai-response">
          {result.display && <div className="display-text">{result.display}</div>}
          {result.data && result.data.length > 0 && (
            <div className="data-table">
              <h4>Результат (первые {result.data.length} строк)</h4>
              {renderData(result.data)}
            </div>
          )}
          {result.sql && (
            <details>
              <summary>SQL запрос</summary>
              <pre>{result.sql}</pre>
            </details>
          )}
          {result.error && <div className="error">Ошибка: {result.error}</div>}
        </div>
      )}
    </div>
  );
};

export default AIQueryPanel;