import React, { useState } from 'react';
import { useDataQuery } from '@hooks';

const AIPanel: React.FC = () => {
    const { data, filters, groupBy } = useDataQuery();
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState('');

    const mockAIRequest = async (action: string) => {
        setLoading(true);
        setTimeout(() => {
            setResponse(`Ответ на действие "${action}": (заглушка) получено ${data.length} строк, фильтры: ${JSON.stringify(filters)}`);
            setLoading(false);
        }, 1000);
    };

    return (
        <div className="ai-panel">
            <h3>AI-помощник</h3>
            <div className="ai-buttons">
                <button onClick={() => mockAIRequest('Общая статистика')}>
                    Общая статистика
                </button>
                <button onClick={() => mockAIRequest('Прогноз продаж')}>
                    Прогноз
                </button>
                <button onClick={() => mockAIRequest('Выявить аномалии')}>
                    Аномалии
                </button>
                <button onClick={() => mockAIRequest('Сгенерировать отчёт')}>
                    Отчёт
                </button>
            </div>
            {loading && <div className="ai-loading">Обработка...</div>}
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