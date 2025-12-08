
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles, Database, X, Terminal, ChevronRight, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react'; 
import { runHarAgent } from '../services/geminiService';
import { ExtractedEntity, ToolCall, ChatMessage } from '../types';
import { useProjectStore } from '../store/projectStore';
import JsonViewer from './JsonViewer';

interface ChatInterfaceProps {
  onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose }) => {
  const { activeProject, setChatMessages, setKnowledgeData } = useProjectStore();
  const harData = activeProject?.harEntries || [];
  const messages = activeProject?.chatHistory || [];
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    
    // Add User Message
    const userMessage: ChatMessage = { role: 'user', text: userMsg, id: Date.now().toString() };
    setChatMessages(prev => [...prev, userMessage]);
    
    // Initialize Model Message (Placeholder)
    const modelMsgId = (Date.now() + 1).toString();
    const initModelMessage: ChatMessage = { role: 'model', text: '', id: modelMsgId, toolCalls: [] };
    setChatMessages(prev => [...prev, initModelMessage]);
    
    setLoading(true);

    try {
      const historyForAgent = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, text: m.text }));

      const responseText = await runHarAgent(
          historyForAgent, 
          userMsg, 
          harData,
          {
            onDataExtracted: (extractedData) => {
               const entities: ExtractedEntity[] = extractedData.map((d, i) => ({
                   id: d.id || `extracted-${Date.now()}-${i}`,
                   type: d.type || 'ExtractedItem',
                   label: d.label || d.name || d.title || `Item ${i}`,
                   data: d
               }));
               
               // Update Knowledge Graph via Store
               setKnowledgeData(prev => {
                  const nextNodes = [...prev.nodes];
                  const nextLinks = [...prev.links];
                  
                  entities.forEach(entity => {
                      if (!nextNodes.find(n => n.id === entity.id)) {
                          nextNodes.push(entity);
                      }
                      // Auto-linking logic repeated here or moved to utility
                      Object.entries(entity.data).forEach(([key, value]) => {
                          if (typeof value === 'string' && (key.endsWith('Id') || key === 'id')) {
                              const targetNode = nextNodes.find(n => n.id === value && n.id !== entity.id);
                              if (targetNode) nextLinks.push({ source: entity.id, target: targetNode.id, label: key });
                              const sourceNode = nextNodes.find(n => n.data.id === value && n.id !== entity.id);
                              if (sourceNode) nextLinks.push({ source: sourceNode.id, target: entity.id, label: key });
                          }
                      });
                  });
                  return { nodes: nextNodes, links: nextLinks };
               });
            },
            onToolUpdate: (toolCall) => {
                setChatMessages(prev => {
                    // Update the last message (which is the model message we just created)
                    const updatedMessages = [...prev];
                    const lastMsgIndex = updatedMessages.findIndex(m => m.id === modelMsgId);
                    
                    if (lastMsgIndex !== -1) {
                        const msg = { ...updatedMessages[lastMsgIndex] };
                        const tools = [...(msg.toolCalls || [])];
                        
                        const existingToolIdx = tools.findIndex(t => t.id === toolCall.id);
                        if (existingToolIdx !== -1) {
                            tools[existingToolIdx] = toolCall;
                        } else {
                            tools.push(toolCall);
                        }
                        
                        msg.toolCalls = tools;
                        updatedMessages[lastMsgIndex] = msg;
                    }
                    return updatedMessages;
                });
            }
          }
      );

      // Final update with text
      setChatMessages(prev => {
          const updatedMessages = [...prev];
          const lastMsgIndex = updatedMessages.findIndex(m => m.id === modelMsgId);
          if (lastMsgIndex !== -1) {
             updatedMessages[lastMsgIndex] = { ...updatedMessages[lastMsgIndex], text: responseText };
          }
          return updatedMessages;
      });

    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error communicating with Gemini.' }]);
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
        <div className="flex items-center gap-2"> 
            <div className="text-xs text-gray-500 flex items-center gap-1">
                <Database size={12} />
                {harData.filter(e => e._selected).length > 0 ? `${harData.filter(e => e._selected).length} selected` : 'All entries'}
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors" title="Close chat">
                <X size={16} />
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex flex-col gap-1 max-w-[90%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-blue-700 text-white rounded-tr-none' 
                    : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
                }`}>
                  {msg.text}
                  {(!msg.text && msg.toolCalls?.length === 0 && loading && idx === messages.length - 1) && (
                      <span className="italic text-gray-400">Thinking...</span>
                  )}
                </div>
              </div>

              {/* Tool Calls Rendering */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className={`mt-2 space-y-2 w-full ${msg.role === 'user' ? 'pr-11' : 'pl-11'}`}>
                    {msg.toolCalls.map(tool => (
                        <ToolCallItem key={tool.id} tool={tool} />
                    ))}
                </div>
              )}

            </div>
          </div>
        ))}
        
        {loading && messages.length > 0 && messages[messages.length - 1].role !== 'model' && (
             // Fallback loader if model message hasn't appeared yet (unlikely with new logic)
            <div className="flex justify-start">
                 <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                        <Bot size={16} />
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

// Sub-component for individual tool calls
const ToolCallItem: React.FC<{ tool: ToolCall }> = ({ tool }) => {
    const [expanded, setExpanded] = useState(false);
    
    const isPending = tool.status === 'pending';
    const isError = tool.status === 'error';
    const isSuccess = tool.status === 'success';

    return (
        <div className="bg-gray-900/50 border border-gray-700 rounded-md overflow-hidden text-xs">
            <div 
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-800 transition-colors select-none"
            >
                {expanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                
                {isPending && <Loader2 size={14} className="animate-spin text-blue-400" />}
                {isSuccess && <CheckCircle2 size={14} className="text-green-500" />}
                {isError && <AlertCircle size={14} className="text-red-400" />}

                <span className="font-mono text-gray-300 flex-1">{tool.name}</span>
                
                <span className={`px-1.5 py-0.5 rounded uppercase text-[9px] font-bold ${
                    isPending ? 'bg-blue-900/30 text-blue-300' :
                    isSuccess ? 'bg-green-900/30 text-green-300' :
                    'bg-red-900/30 text-red-300'
                }`}>
                    {tool.status}
                </span>
            </div>
            
            {expanded && (
                <div className="border-t border-gray-800 p-2 bg-gray-950 font-mono">
                    <div className="mb-2">
                        <span className="text-gray-500 block mb-1">Input (Args):</span>
                        <div className="pl-2 border-l border-gray-800">
                             <JsonViewer data={tool.args} initialExpanded={true} />
                        </div>
                    </div>
                    {tool.result && (
                         <div>
                            <span className="text-gray-500 block mb-1">Output (Result):</span>
                            <div className="pl-2 border-l border-gray-800 max-h-60 overflow-y-auto">
                                <JsonViewer data={tool.result} initialExpanded={false} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatInterface;
