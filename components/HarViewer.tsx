import React, { useState, useMemo } from 'react';
import { HarEntryWrapper } from '../types';
import { Search, Filter, Layers, Clock, CheckSquare, Square, Trash2, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react';
import JsonViewer from './JsonViewer';

interface HarViewerProps {
  entries: HarEntryWrapper[];
  setEntries: React.Dispatch<React.SetStateAction<HarEntryWrapper[]>>;
}

type ViewType = 'TABLE' | 'WATERFALL';

const HarViewer: React.FC<HarViewerProps> = ({ entries, setEntries }) => {
  const [filter, setFilter] = useState('');
  const [viewType, setViewType] = useState<ViewType>('TABLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupByUrl, setGroupByUrl] = useState(false);

  // Parse JSON content for the selected entry to show in the side panel
  const selectedEntry = useMemo(() => entries.find(e => e._id === selectedId), [entries, selectedId]);
  const selectedJson = useMemo(() => {
    if (!selectedEntry?.response.content.text) return null;
    try {
      return JSON.parse(selectedEntry.response.content.text);
    } catch {
      return { error: 'Could not parse JSON', raw: selectedEntry.response.content.text };
    }
  }, [selectedEntry]);

  // Derived filtered entries
  const displayedEntries = useMemo(() => {
    let data = entries;
    if (filter) {
      const lower = filter.toLowerCase();
      data = data.filter(e => e.request.url.toLowerCase().includes(lower));
    }
    
    if (groupByUrl) {
      // Simple grouping by URL w/o query params
      const groups: Record<string, HarEntryWrapper[]> = {};
      data.forEach(e => {
        const key = e.request.method + ' ' + e.request.url.split('?')[0];
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
      });
      // Flatten but keep group logic visible? For now just showing unique endpoints could be tricky in a flat list.
      // Let's return just the first of each group for the "Grouped" view, or maybe a tree structure.
      // To keep it simple for this iteration: Filter to show only unique method+path
      const unique: HarEntryWrapper[] = [];
      const seen = new Set<string>();
      data.forEach(e => {
          const key = e.request.method + ' ' + e.request.url.split('?')[0];
          if (!seen.has(key)) {
              seen.add(key);
              unique.push({ ...e, _groupKey: key }); // Mark as representative
          }
      });
      return unique;
    }

    return data;
  }, [entries, filter, groupByUrl]);

  // Bulk Selection Logic
  const toggleSelection = (id: string) => {
    setEntries(prev => prev.map(e => e._id === id ? { ...e, _selected: !e._selected } : e));
  };

  const toggleAll = () => {
    const allSelected = displayedEntries.every(e => e._selected);
    setEntries(prev => prev.map(e => displayedEntries.find(d => d._id === e._id) ? { ...e, _selected: !allSelected } : e));
  };

  const removeUnselected = () => {
    if (confirm('Remove all unselected entries from the workspace?')) {
        setEntries(prev => prev.filter(e => e._selected));
    }
  };
  
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-blue-400 bg-blue-400/10';
      case 'POST': return 'text-green-400 bg-green-400/10';
      case 'PUT': return 'text-yellow-400 bg-yellow-400/10';
      case 'DELETE': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  // Waterfall calculations
  const startTime = useMemo(() => entries.length ? Math.min(...entries.map(e => new Date(e.startedDateTime).getTime())) : 0, [entries]);
  const endTime = useMemo(() => entries.length ? Math.max(...entries.map(e => new Date(e.startedDateTime).getTime() + e.time)) : 0, [entries]);
  const totalDuration = endTime - startTime || 1;

  return (
    <div className="flex h-full w-full bg-gray-900">
      {/* Left Panel: List/Waterfall */}
      <div className={`${selectedId ? 'w-1/2' : 'w-full'} flex flex-col border-r border-gray-700 transition-all duration-300`}>
        {/* Toolbar */}
        <div className="p-3 border-b border-gray-700 bg-gray-800 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Filter requests..."
                        className="w-full bg-gray-900 border border-gray-600 rounded pl-8 pr-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <div className="flex bg-gray-900 rounded border border-gray-700 p-0.5">
                    <button 
                        onClick={() => setViewType('TABLE')}
                        className={`p-1.5 rounded ${viewType === 'TABLE' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Table View"
                    >
                        <Layers size={16} />
                    </button>
                    <button 
                        onClick={() => setViewType('WATERFALL')}
                        className={`p-1.5 rounded ${viewType === 'WATERFALL' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Waterfall View"
                    >
                        <Clock size={16} />
                    </button>
                </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-3">
                    <button onClick={toggleAll} className="flex items-center gap-1 hover:text-white">
                        {displayedEntries.length > 0 && displayedEntries.every(e => e._selected) ? <CheckSquare size={14} /> : <Square size={14} />}
                        Select All
                    </button>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-white">
                        <input type="checkbox" checked={groupByUrl} onChange={e => setGroupByUrl(e.target.checked)} className="rounded bg-gray-700 border-gray-600" />
                        Group by Endpoint
                    </label>
                </div>
                <button onClick={removeUnselected} className="flex items-center gap-1 text-red-400 hover:text-red-300">
                    <Trash2 size={12} /> Clean Unselected
                </button>
            </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
            {displayedEntries.map((entry) => {
                const startOffset = new Date(entry.startedDateTime).getTime() - startTime;
                const widthPercent = (entry.time / totalDuration) * 100;
                const leftPercent = (startOffset / totalDuration) * 100;

                const isSelected = selectedId === entry._id;
                
                return (
                    <div 
                        key={entry._id} 
                        className={`
                            group flex items-center border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer
                            ${isSelected ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}
                        `}
                        onClick={() => setSelectedId(entry._id)}
                    >
                        {/* Checkbox */}
                        <div className="pl-3 pr-2 py-3" onClick={(e) => { e.stopPropagation(); toggleSelection(entry._id); }}>
                            {entry._selected ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} className="text-gray-600 group-hover:text-gray-500" />}
                        </div>

                        <div className="flex-1 min-w-0 py-2 pr-3">
                             <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-1.5 rounded ${getMethodColor(entry.request.method)}`}>
                                    {entry.request.method}
                                </span>
                                <span className={`text-[10px] ${entry.response.status < 400 ? 'text-green-400' : 'text-red-400'}`}>
                                    {entry.response.status}
                                </span>
                                {entry._groupKey && (
                                    <span className="text-[10px] bg-gray-700 text-gray-300 px-1 rounded">Grouped</span>
                                )}
                                <span className="text-xs text-gray-500 ml-auto">
                                    {(entry.response.content.size / 1024).toFixed(1)} KB
                                </span>
                             </div>
                             
                             <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-300 truncate font-mono" title={entry.request.url}>
                                    {entry.request.url.split('?')[0].split('/').slice(-2).join('/')}
                                </div>
                                <div className="text-[10px] text-gray-500">{Math.round(entry.time)}ms</div>
                             </div>

                             {viewType === 'WATERFALL' && (
                                 <div className="mt-2 h-1 bg-gray-800 rounded-full w-full relative overflow-hidden">
                                     <div 
                                        className="absolute h-full bg-blue-600 rounded-full opacity-50"
                                        style={{ left: `${leftPercent}%`, width: `${Math.max(widthPercent, 0.5)}%` }}
                                     />
                                 </div>
                             )}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {/* Right Panel: Details */}
      {selectedId && selectedEntry && (
          <div className="w-1/2 flex flex-col bg-gray-800 border-l border-gray-700 animate-in slide-in-from-right-10 duration-200">
             <div className="p-3 border-b border-gray-700 bg-gray-900 flex justify-between items-center shadow-md">
                 <div className="flex flex-col min-w-0">
                    <h3 className="font-bold text-gray-200 text-sm truncate max-w-md" title={selectedEntry.request.url}>{selectedEntry.request.url}</h3>
                    <div className="flex gap-2 text-xs text-gray-500 mt-1">
                        <span>{selectedEntry.request.method}</span>
                        <span>&bull;</span>
                        <span>{selectedEntry.response.status} {selectedEntry.response.statusText}</span>
                    </div>
                 </div>
                 <button onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-white">
                     <ArrowRight size={18} />
                 </button>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Headers Section */}
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Request Headers</h4>
                    <div className="bg-gray-900 rounded p-2 text-xs font-mono space-y-1 overflow-x-auto">
                        {selectedEntry.request.headers.slice(0, 5).map((h, i) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-blue-400 min-w-[100px]">{h.name}:</span>
                                <span className="text-gray-300 break-all">{h.value.length > 50 ? h.value.substring(0, 50) + '...' : h.value}</span>
                            </div>
                        ))}
                         {selectedEntry.request.headers.length > 5 && <div className="text-gray-600 italic">... {selectedEntry.request.headers.length - 5} more</div>}
                    </div>
                </div>

                {/* Response Body Section */}
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">Response Body (JSON)</h4>
                        <span className="text-xs text-gray-600">{(selectedEntry.response.content.size / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="bg-gray-900 rounded p-2 overflow-auto border border-gray-700 min-h-[300px]">
                         {selectedJson ? (
                             <JsonViewer data={selectedJson} initialExpanded={true} />
                         ) : (
                             <pre className="text-xs text-gray-400 whitespace-pre-wrap">{selectedEntry.response.content.text || '<No Content>'}</pre>
                         )}
                    </div>
                </div>

             </div>
          </div>
      )}
    </div>
  );
};

export default HarViewer;
