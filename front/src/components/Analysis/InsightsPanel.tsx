import React, { useState, useRef, useEffect } from 'react';
import { useDataQuery } from '@hooks';
import { api } from '@services';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const AIPanel: React.FC = () => {
  const { data, filters, groupBy } = useDataQuery();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResp, setLastResp] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const response = await api.sendAIQuery(input, { filters, groupBy, dataSample: data.slice(0, 100) });
      // api.sendAIQuery returns stringified JSON of backend response
      let parsed: any = null;
      try { parsed = JSON.parse(response); } catch (e) { parsed = null; }
      setLastResp(parsed);
      const displayText = parsed && parsed.display ? parsed.display : (parsed && parsed.status ? parsed.status : String(response));
      const aiMsg: Message = {
        id: Date.now() + 1,
        text: displayText,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI error:', err);
      const errorMsg: Message = {
        id: Date.now() + 1,
        text: 'Ошибка при обращении к AI-сервису',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-panel">
      <h3>AI-помощник</h3>
      <div className="ai-chat-history">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className="message-sender">{msg.sender === 'user' ? 'Вы' : 'AI'}</div>
            <div className="message-text">{msg.text}</div>
            <div className="message-time">{msg.timestamp.toLocaleTimeString()}</div>
          </div>
        ))}
        {loading && <div className="typing-indicator">AI печатает...</div>}
        <div ref={messagesEndRef} />
      </div>
      {/* DISPLAY / TABLE / DEBUG zones */}
      <div style={{ borderTop: '1px solid #eee', marginTop: '8px', paddingTop: '8px' }}>
        <h4>DISPLAY</h4>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: '8px' }}>{lastResp ? lastResp.display : ''}</pre>

        <h4>TABLE (data)</h4>
        <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>id</th>
                <th>sale_date</th>
                <th>region</th>
                <th>product_category</th>
                <th>product_name</th>
                <th>quantity</th>
                <th>price</th>
                <th>revenue</th>
              </tr>
            </thead>
            <tbody>
              {(lastResp && Array.isArray(lastResp.data) ? lastResp.data : []).slice(0, 100).map((row: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                  <td>{row.id}</td>
                  <td>{row.sale_date}</td>
                  <td>{row.region}</td>
                  <td>{row.product_category}</td>
                  <td>{row.product_name}</td>
                  <td>{row.quantity}</td>
                  <td>{row.price}</td>
                  <td>{row.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 style={{ marginTop: 8 }}>DEBUG</h4>
        <div style={{ fontSize: 12, color: '#666' }}>
          <div><strong>SQL:</strong> <code>{lastResp ? lastResp.sql : ''}</code></div>
          <div><strong>row_count:</strong> {lastResp ? String(lastResp.row_count) : ''}</div>
        </div>
      </div>
      <div className="ai-input-area">
        <textarea
          rows={2}
          placeholder="Задайте вопрос или дайте команду..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? 'Отправка...' : 'Отправить'}
        </button>
      </div>
    </div>
  );
};

export default AIPanel;