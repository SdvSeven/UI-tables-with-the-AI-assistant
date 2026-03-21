import React, { useState } from 'react';
import { useDataQuery } from '@hooks';
import { api } from '@services';

const AIPanel: React.FC = () => {
  const { data, filters, groupBy } = useDataQuery();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [query, setQuery] = useState('');

  const sendQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await api.sendAIQuery(query, { filters, groupBy, dataSample: data.slice(0, 100) });
      setResponse(result);
    } catch (err) {
      console.error('AI error:', err);
      setResponse('Ошибка при обращении к AI-сервису');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel">
      <h3>AI-помощник</h3>
      <div className="ai-input-area">
        <textarea
          rows={3}
          placeholder="Задайте вопрос или дайте команду..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendQuery();
            }
          }}
        />
        <button onClick={sendQuery} disabled={loading}>
          {loading ? 'Отправка...' : 'Отправить'}
        </button>
      </div>
      {response && (
        <div className="ai-response">
          <strong>Ответ:</strong>
          <pre>{response}</pre>
        </div>
      )}
    </div>
  );
};

export default AIPanel;