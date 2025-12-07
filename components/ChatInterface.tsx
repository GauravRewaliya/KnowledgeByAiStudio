import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles, Database } from 'lucide-react';
import { runHarAgent } from '../services/geminiService';
import { HarEntryWrapper, ExtractedEntity } from '../types';

interface ChatInterfaceProps {
  harData: HarEntryWrapper[];
  onExtractData: (entities: ExtractedEntity[]) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ harData, onExtractData }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([
    { role: 'model', text: 'Hello! I am ready to analyze your HAR file. I can inspect requests, understand the data structure, and extract specific information into the Knowledge Graph.' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await runHarAgent(
          messages.filter(m => m.role !== 'system'), 
          userMsg, 
          harData,
          (extractedData) => {
             // Adapt extracted data to Entity format if needed, or assume agent produces generic data
             // We'll wrap generic data into 'ExtractedEntity' if it lacks id/type
             const entities: ExtractedEntity[] = extractedData.map((d, i) => ({
                 id: d.id || `extracted-${Date.now()}-${i}`,
                 type: d.type || 'ExtractedItem',
                 label: d.label || d.name || d.title || `Item ${i}`,
                 data: d
             }));
             onExtractData(entities);
          }
      );
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error communicating with Gemini.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      <div className="p-3 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Sparkles className="text-yellow-400 w-5 h-5" />
            <h3 className="font-semibold text-gray-200">HarMind Agent</h3>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1">
            <Database size={12} />
            {harData.filter(e => e._selected).length > 0 ? `${harData.filter(e => e._selected).length} selected` : 'All entries'}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-blue-700 text-white rounded-tr-none' 
                  : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
              }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
             <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                    <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="bg-gray-800 p-3 rounded-lg rounded-tl-none border border-gray-700 text-gray-400 text-sm italic">
                    Analyzing HAR structure & executing tools...
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="E.g., 'Find all project IDs in the response'"
            className="w-full bg-gray-900 text-white border border-gray-600 rounded-full pl-4 pr-12 py-3 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-2 p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-500 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
