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
      const aiMsg: Message = {
        id: Date.now() + 1,
        text: response,
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