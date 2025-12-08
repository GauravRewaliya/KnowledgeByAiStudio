
import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { ScrapingEntry, ProcessingStatus } from '../types';
import { Play, Database, Code, FileJson, CheckCircle, Clock, Trash2, Search, ArrowRight } from 'lucide-react';
import JsonViewer from './JsonViewer';

const KnowledgeDbPanel: React.FC = () => {
  const { activeProject, updateScrapingEntry, deleteScrapingEntry } = useProjectStore();
  const entries = activeProject?.scrapingEntries || [];
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedEntry = entries.find(e => e.id === selectedId);

  const [filter, setFilter] = useState('');

  const filteredEntries = entries.filter(e => 
    e.url.toLowerCase().includes(filter.toLowerCase()) || 
    e.source_type_key.toLowerCase().includes(filter.toLowerCase())
  );

  const getStatusColor = (status: ProcessingStatus) => {
    switch (status) {
      case ProcessingStatus.FinalResponse: return 'text-green-400';
      case ProcessingStatus.Unprocessed: return 'text-gray-500';
      default: return 'text-yellow-400';
    }
  };

  return (
    <div className="flex h-full w-full bg-gray-900 text-white">
      {/* List Panel */}
      <div className={`${selectedId ? 'w-1/3' : 'w-full'} border-r border-gray-700 flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-gray-700 bg-gray-800 flex flex-col gap-3">
             <h2 className="text-lg font-bold flex items-center gap-2">
                 <Database className="text-purple-500" /> Knowledge DB
             </h2>
             <div className="relative">
                 <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                 <input 
                    type="text" 
                    placeholder="Search scraping entries..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded pl-8 pr-2 py-1.5 text-sm focus:outline-none"
                 />
             </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No entries found. Sync requests from Explore tab.</div>
            ) : (
                filteredEntries.map(entry => (
                    <div 
                        key={entry.id}
                        onClick={() => setSelectedId(entry.id)}
                        className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 ${selectedId === entry.id ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-mono font-bold text-gray-300 bg-gray-700 px-1 rounded">{entry.request.method}</span>
                            <span className={`text-[10px] uppercase font-bold ${getStatusColor(entry.processing_status)}`}>{entry.processing_status}</span>
                        </div>
                        <div className="text-sm truncate text-gray-400 mb-1" title={entry.source_type_key}>{entry.source_type_key}</div>
                        <div className="text-xs text-gray-600 truncate">{entry.url}</div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Detail/Editor Panel */}
      {selectedId && selectedEntry && (
          <div className="w-2/3 flex flex-col bg-gray-900">
              <div className="p-3 border-b border-gray-700 bg-gray-800 flex justify-between items-center shadow-md">
                   <div className="flex flex-col">
                       <h3 className="text-sm font-bold text-gray-200">Pipeline Editor</h3>
                       <div className="text-xs text-gray-500">{selectedEntry.id}</div>
                   </div>
                   <div className="flex gap-2">
                       <button 
                         onClick={() => deleteScrapingEntry(selectedEntry.id)}
                         className="p-1.5 text-red-400 hover:bg-red-900/20 rounded"
                         title="Delete Entry"
                       >
                           <Trash2 size={16} />
                       </button>
                       <button onClick={() => setSelectedId(null)} className="p-1.5 text-gray-400 hover:text-white"><ArrowRight size={16} /></button>
                   </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  
                  {/* Step 1: Request & Raw Response */}
                  <PipelineStep 
                    title="1. Source" 
                    icon={<FileJson size={16} />} 
                    status="completed"
                  >
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800 p-2 rounded">
                              <div className="text-xs text-gray-500 mb-1 uppercase">Request</div>
                              <JsonViewer data={{ url: selectedEntry.url, method: selectedEntry.request.method, headers: selectedEntry.request.headers }} />
                          </div>
                          <div className="bg-gray-800 p-2 rounded max-h-40 overflow-auto">
                              <div className="text-xs text-gray-500 mb-1 uppercase">Response Preview</div>
                              <JsonViewer data={selectedEntry.response} />
                          </div>
                      </div>
                  </PipelineStep>

                  {/* Step 2: Filterer JSON */}
                  <PipelineStep 
                    title="2. Schema / Filter" 
                    icon={<Search size={16} />} 
                    status={selectedEntry.filterer_json && Object.keys(selectedEntry.filterer_json).length ? 'completed' : 'pending'}
                  >
                      <Editor 
                         value={JSON.stringify(selectedEntry.filterer_json, null, 2)}
                         onChange={(val) => {
                             try {
                                 const json = JSON.parse(val);
                                 updateScrapingEntry(selectedEntry.id, { filterer_json: json, processing_status: ProcessingStatus.Filtered });
                             } catch {}
                         }}
                         lang="json"
                         placeholder="Define schema/filter JSON..."
                      />
                  </PipelineStep>

                  {/* Step 3: Converter Code */}
                  <PipelineStep 
                    title="3. Converter Logic" 
                    icon={<Code size={16} />} 
                    status={selectedEntry.converter_code ? 'completed' : 'pending'}
                  >
                      <Editor 
                         value={selectedEntry.converter_code}
                         onChange={(val) => updateScrapingEntry(selectedEntry.id, { converter_code: val })}
                         lang="js"
                         placeholder="// Write JS to convert filtered data..."
                      />
                      <div className="mt-2 flex justify-end">
                          <button 
                            className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs flex items-center gap-1"
                            onClick={() => {
                                try {
                                    // Mock execution
                                    const code = selectedEntry.converter_code;
                                    // In real app, run unsafe code in worker or better sandbox. 
                                    // For now, simple try/catch
                                    const result = { success: true, message: "Code saved. Run via Agent to process." }; 
                                    // We could actually run it here if we mock the context.
                                    updateScrapingEntry(selectedEntry.id, { processing_status: ProcessingStatus.Converted });
                                    alert("Converter status updated.");
                                } catch (e) {}
                            }}
                          >
                              <Play size={12} /> Test Run
                          </button>
                      </div>
                  </PipelineStep>

                  {/* Step 4: Final Response */}
                  <PipelineStep 
                    title="4. Final Output" 
                    icon={<CheckCircle size={16} />} 
                    status={selectedEntry.processing_status === ProcessingStatus.FinalResponse ? 'completed' : 'pending'}
                  >
                      <div className="bg-gray-800 p-2 rounded min-h-[100px]">
                           {Object.keys(selectedEntry.final_clean_response).length > 0 ? (
                               <JsonViewer data={selectedEntry.final_clean_response} />
                           ) : (
                               <div className="text-gray-500 text-xs italic">No final response generated yet.</div>
                           )}
                      </div>
                  </PipelineStep>
              </div>
          </div>
      )}
    </div>
  );
};

const PipelineStep: React.FC<{ title: string; icon: any; children: React.ReactNode; status: 'completed' | 'pending' | 'active' }> = ({ title, icon, children, status }) => {
    return (
        <div className="relative pl-6 pb-6 border-l border-gray-700 last:border-0">
            <div className={`absolute -left-3 top-0 w-6 h-6 rounded-full flex items-center justify-center border-2 ${status === 'completed' ? 'bg-green-900 border-green-500 text-green-400' : 'bg-gray-800 border-gray-600 text-gray-500'}`}>
                {status === 'completed' ? <CheckCircle size={12} /> : icon}
            </div>
            <h4 className={`text-sm font-bold mb-3 ${status === 'completed' ? 'text-green-400' : 'text-gray-300'}`}>{title}</h4>
            <div className="pl-2">
                {children}
            </div>
        </div>
    );
};

const Editor: React.FC<{ value: string; onChange: (val: string) => void; lang: 'json' | 'js'; placeholder?: string }> = ({ value, onChange, lang, placeholder }) => (
    <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-32 bg-[#1e1e1e] border border-gray-700 rounded p-3 font-mono text-xs focus:outline-none focus:border-blue-500 ${lang === 'js' ? 'text-yellow-300' : 'text-green-300'}`}
        spellCheck={false}
    />
);

export default KnowledgeDbPanel;
