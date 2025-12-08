
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { HarEntryWrapper } from '../types';
import { useProjectStore } from '../store/projectStore';
import { Search, Layers, Clock, CheckSquare, Square, Trash2, ArrowRight, AlertTriangle, ChevronRight, ChevronDown, FilePlus, Folder, FileText, Terminal, CheckCircle2, Database } from 'lucide-react';
import JsonViewer from './JsonViewer';
import { generateCurlCommand } from '../services/harUtils';

interface HarViewerProps {
  onAddHar: () => void;
}

type ViewType = 'TABLE' | 'WATERFALL';
type GroupMode = 'NONE' | 'FILE' | 'ENDPOINT';

const HarViewer: React.FC<HarViewerProps> = ({ onAddHar }) => {
  // Store Hooks
  const { activeProject, setHarEntries, syncHarToDb } = useProjectStore();
  const entries = activeProject?.harEntries || [];
  
  // Local UI State
  const [filter, setFilter] = useState('');
  const [viewType, setViewType] = useState<ViewType>('TABLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>('NONE');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [syncedMsg, setSyncedMsg] = useState(false);

  // Helper to update global state safely
  const updateGlobalEntries = (newEntries: HarEntryWrapper[]) => {
      setHarEntries(newEntries);
  };

  // Parse JSON content for the selected entry
  const selectedEntry = useMemo(() => entries.find(e => e._id === selectedId), [entries, selectedId]);
  const selectedJson = useMemo(() => {
    if (!selectedEntry?.response.content.text) return null;
    try {
      return JSON.parse(selectedEntry.response.content.text);
    } catch {
      return { error: 'Could not parse JSON', raw: selectedEntry.response.content.text };
    }
  }, [selectedEntry]);

  // --- Filtering & Grouping Logic ---

  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const lower = filter.toLowerCase();
    return entries.filter(e => e.request.url.toLowerCase().includes(lower));
  }, [entries, filter]);

  const flatTree = useMemo(() => {
    if (groupMode === 'NONE') {
        return filteredEntries.map(e => ({ type: 'ENTRY', data: e }));
    }

    const groups: Record<string, HarEntryWrapper[]> = {};
    const groupTitles: Record<string, string> = {};

    filteredEntries.forEach(e => {
        let key = '';
        let title = '';

        if (groupMode === 'FILE') {
            key = e._harId;
            title = e._harName;
        } else {
            const urlObj = new URL(e.request.url);
            key = e.request.method + ':' + urlObj.pathname;
            title = `${e.request.method} ${urlObj.pathname}`;
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
        groupTitles[key] = title;
    });

    const result: any[] = [];
    Object.keys(groups).sort().forEach(key => {
        const isExpanded = expandedGroups.has(key);
        result.push({ 
            type: 'HEADER', 
            key, 
            title: groupTitles[key], 
            count: groups[key].length, 
            isExpanded 
        });

        if (isExpanded) {
            groups[key].forEach(e => result.push({ type: 'ENTRY', data: e }));
        }
    });

    return result;

  }, [filteredEntries, groupMode, expandedGroups]);


  // --- Selection Logic ---

  const toggleSelection = useCallback((id: string) => {
    const newEntries = entries.map(e => e._id === id ? { ...e, _selected: !e._selected } : e);
    updateGlobalEntries(newEntries);
  }, [entries]);

  const toggleGroupSelection = (key: string) => {
    const groupIds = new Set<string>();
    filteredEntries.forEach(e => {
        let eKey = '';
        if (groupMode === 'FILE') eKey = e._harId;
        else {
             const urlObj = new URL(e.request.url);
             eKey = e.request.method + ':' + urlObj.pathname;
        }
        
        if (eKey === key) groupIds.add(e._id);
    });

    const targetState = !entries.filter(e => groupIds.has(e._id)).every(e => e._selected);
    const newEntries = entries.map(e => groupIds.has(e._id) ? { ...e, _selected: targetState } : e);
    updateGlobalEntries(newEntries);
  };

  const toggleAll = () => {
    const visibleIds = new Set(filteredEntries.map(e => e._id));
    const allVisibleSelected = filteredEntries.every(e => e._selected);
    const targetState = !allVisibleSelected;
    const newEntries = entries.map(e => visibleIds.has(e._id) ? { ...e, _selected: targetState } : e);
    updateGlobalEntries(newEntries);
  };

  const toggleGroupExpand = (key: string) => {
      setExpandedGroups(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
      });
  };

  const selectedCount = entries.filter(e => e._selected).length;
  const isAllDisplayedSelected = filteredEntries.length > 0 && filteredEntries.every(e => e._selected);

  const handleDeleteClick = useCallback(() => {
      if (selectedCount > 0) setShowDeleteConfirm(true);
  }, [selectedCount]);

  const confirmDelete = useCallback(() => {
    const newEntries = entries.filter(e => !e._selected);
    updateGlobalEntries(newEntries);
    setSelectedId(null);
    setShowDeleteConfirm(false);
  }, [entries]);

  const handleSyncToDb = () => {
      const selected = entries.filter(e => e._selected);
      if (selected.length === 0) return;
      
      syncHarToDb(selected);
      setSyncedMsg(true);
      setTimeout(() => setSyncedMsg(false), 2000);
  };
  
  // --- Keyboard & Styling (unchanged logic) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (showDeleteConfirm) {
            if (e.key === 'Enter') { e.preventDefault(); confirmDelete(); } 
            else if (e.key === 'Escape') { e.preventDefault(); setShowDeleteConfirm(false); }
            return;
        }
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedCount > 0) { e.preventDefault(); handleDeleteClick(); }
        }
        if (e.key === 'Escape' && selectedId) {
            e.preventDefault(); setSelectedId(null);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm, selectedCount, selectedId, confirmDelete, handleDeleteClick]);

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-blue-400 bg-blue-400/10';
      case 'POST': return 'text-green-400 bg-green-400/10';
      case 'PUT': return 'text-yellow-400 bg-yellow-400/10';
      case 'DELETE': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const handleCopyCurl = () => {
    if (selectedEntry) {
        const cmd = generateCurlCommand(selectedEntry.request);
        navigator.clipboard.writeText(cmd);
        setCurlCopied(true);
        setTimeout(() => setCurlCopied(false), 2000);
    }
  };

  const startTime = useMemo(() => entries.length ? Math.min(...entries.map(e => new Date(e.startedDateTime).getTime())) : 0, [entries]);
  const endTime = useMemo(() => entries.length ? Math.max(...entries.map(e => new Date(e.startedDateTime).getTime() + e.time)) : 0, [entries]);
  const totalDuration = endTime - startTime || 1;

  return (
    <div className="flex h-full w-full bg-gray-900 relative">
      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 max-w-sm w-full">
                <div className="flex items-center gap-3 text-red-400 mb-4">
                    <AlertTriangle size={24} />
                    <h3 className="text-lg font-bold text-white">Confirm Deletion</h3>
                </div>
                <p className="text-gray-300 mb-6">
                    Delete <span className="font-bold text-white">{selectedCount}</span> entries?
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded bg-gray-700 text-gray-200 text-sm">Cancel</button>
                    <button onClick={confirmDelete} className="px-4 py-2 rounded bg-red-600 text-white text-sm">Delete</button>
                </div>
            </div>
        </div>
      )}

      {/* Left Panel */}
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
                <button 
                    onClick={onAddHar}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                >
                    <FilePlus size={16} /> Add HAR
                </button>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-3">
                    <button onClick={toggleAll} className="flex items-center gap-1 hover:text-white font-medium">
                        {isAllDisplayedSelected ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} />}
                        All
                    </button>
                    
                    <div className="flex items-center gap-2 border-l border-gray-700 pl-3">
                        <span className="text-gray-500">Group:</span>
                        <select 
                            value={groupMode} 
                            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
                            className="bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                        >
                            <option value="NONE">None</option>
                            <option value="FILE">By File</option>
                            <option value="ENDPOINT">By Endpoint</option>
                        </select>
                    </div>

                    <div className="flex border border-gray-700 rounded ml-2">
                        <button onClick={() => setViewType('TABLE')} className={`p-1 ${viewType === 'TABLE' ? 'bg-gray-700 text-white' : 'hover:text-white'}`}><Layers size={12} /></button>
                        <button onClick={() => setViewType('WATERFALL')} className={`p-1 ${viewType === 'WATERFALL' ? 'bg-gray-700 text-white' : 'hover:text-white'}`}><Clock size={12} /></button>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleSyncToDb}
                        disabled={selectedCount === 0}
                        className="flex items-center gap-1 text-purple-400 hover:text-purple-300 disabled:opacity-50"
                        title="Sync selected to Knowledge DB"
                    >
                         {syncedMsg ? <CheckCircle2 size={12} className="text-green-500" /> : <Database size={12} />}
                         {syncedMsg ? 'Synced!' : 'To DB'}
                    </button>
                    
                    <button 
                        onClick={handleDeleteClick} 
                        className="flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-50 ml-2" 
                        disabled={selectedCount === 0}
                    >
                        <Trash2 size={12} /> {selectedCount}
                    </button>
                </div>
            </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto outline-none" tabIndex={0}>
            {flatTree.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">No entries found</div>
            ) : (
                flatTree.map((item, idx) => {
                    if (item.type === 'HEADER') {
                        return (
                            <div key={item.key} className="bg-gray-800/80 border-b border-gray-700 px-3 py-2 flex items-center gap-2 select-none sticky top-0 z-10">
                                <button onClick={() => toggleGroupExpand(item.key)} className="text-gray-400 hover:text-white">
                                    {item.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <div onClick={() => toggleGroupSelection(item.key)} className="cursor-pointer">
                                     <Square size={14} className="text-gray-600 hover:text-gray-400" />
                                </div>
                                <div className="flex items-center gap-2 font-semibold text-gray-300 text-xs">
                                    {groupMode === 'FILE' ? <Folder size={14} className="text-yellow-500" /> : <Layers size={14} className="text-purple-500" />}
                                    {item.title}
                                </div>
                                <span className="text-xs text-gray-500 bg-gray-900 px-1.5 rounded-full">{item.count}</span>
                            </div>
                        );
                    }

                    const entry = item.data as HarEntryWrapper;
                    const startOffset = new Date(entry.startedDateTime).getTime() - startTime;
                    const widthPercent = (entry.time / totalDuration) * 100;
                    const leftPercent = (startOffset / totalDuration) * 100;
                    const isSelected = selectedId === entry._id;
                    const isGrouped = groupMode !== 'NONE';

                    return (
                        <div 
                            key={entry._id} 
                            id={`row-${entry._id}`}
                            className={`
                                group flex items-center border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors
                                ${isSelected ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}
                                ${isGrouped ? 'pl-6' : ''} 
                            `}
                            onClick={() => setSelectedId(entry._id)}
                        >
                            <div className="pl-3 pr-2 py-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSelection(entry._id); }}>
                                {entry._selected ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} className="text-gray-600 group-hover:text-gray-500" />}
                            </div>

                            <div className="flex-1 min-w-0 py-2 pr-3">
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-bold px-1.5 rounded ${getMethodColor(entry.request.method)}`}>{entry.request.method}</span>
                                    <span className={`text-[10px] ${entry.response.status < 400 ? 'text-green-400' : 'text-red-400'}`}>{entry.response.status}</span>
                                    {groupMode !== 'FILE' && (
                                        <span className="text-[9px] bg-gray-700 text-gray-400 px-1 rounded flex items-center gap-1 max-w-[80px] truncate" title={entry._harName}>
                                            <FileText size={8} /> {entry._harName}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500 ml-auto">{(entry.response.content.size / 1024).toFixed(1)} KB</span>
                                 </div>
                                 
                                 <div className="flex items-center justify-between">
                                    <div className="text-xs text-gray-300 truncate font-mono" title={entry.request.url}>
                                        {entry.request.url.split('?')[0].split('/').slice(-2).join('/')}
                                    </div>
                                    <div className="text-[10px] text-gray-500">{Math.round(entry.time)}ms</div>
                                 </div>

                                 {viewType === 'WATERFALL' && (
                                     <div className="mt-2 h-1 bg-gray-800 rounded-full w-full relative overflow-hidden">
                                         <div className="absolute h-full bg-blue-600 rounded-full opacity-50" style={{ left: `${leftPercent}%`, width: `${Math.max(widthPercent, 0.5)}%` }} />
                                     </div>
                                 )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>

      {/* Right Panel: Details */}
      {selectedId && selectedEntry && (
          <div className="w-1/2 flex flex-col bg-gray-800 border-l border-gray-700 animate-in slide-in-from-right-10 duration-200">
             <div className="p-3 border-b border-gray-700 bg-gray-900 flex justify-between items-center shadow-md">
                 <div className="flex flex-col min-w-0">
                    <h3 className="font-bold text-gray-200 text-sm truncate max-w-md" title={selectedEntry.request.url}>{selectedEntry.request.url}</h3>
                    <div className="flex gap-2 text-xs text-gray-500 mt-1">
                         <span className="bg-gray-800 px-1 rounded border border-gray-700 text-gray-400">{selectedEntry._harName}</span>
                         <span>&bull;</span>
                         <span>{selectedEntry.request.method}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                     <button 
                        onClick={handleCopyCurl}
                        className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-gray-700 transition-colors relative"
                        title="Copy as cURL"
                     >
                        {curlCopied ? <CheckCircle2 size={16} className="text-green-500" /> : <Terminal size={16} />}
                     </button>
                     <button onClick={() => setSelectedId(null)} className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-gray-700" title="Close"><ArrowRight size={18} /></button>
                 </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Request Headers</h4>
                    <div className="bg-gray-900 rounded p-2 text-xs font-mono space-y-1 overflow-x-auto">
                        {selectedEntry.request.headers.slice(0, 5).map((h, i) => (
                            <div key={i} className="flex gap-2"><span className="text-blue-400 min-w-[100px]">{h.name}:</span><span className="text-gray-300 break-all">{h.value.substring(0, 100)}</span></div>
                        ))}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">Response Body</h4>
                        <span className="text-xs text-gray-600">{(selectedEntry.response.content.size / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="bg-gray-900 rounded p-2 overflow-auto border border-gray-700 min-h-[300px]">
                         {selectedJson ? <JsonViewer data={selectedJson} initialExpanded={true} /> : <pre className="text-xs text-gray-400 whitespace-pre-wrap">{selectedEntry.response.content.text || '<No Content>'}</pre>}
                    </div>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default HarViewer;
