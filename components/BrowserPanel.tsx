
import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { executeProxyRequest } from '../services/backendService';
import { Globe, ArrowRight, Loader2, RefreshCw, Plus, Trash2, Code, Eye, AlertCircle, ChevronDown, FileText, ExternalLink, Terminal } from 'lucide-react';
import JsonViewer from './JsonViewer';
import ConfirmModal from './ConfirmModal';
import { parseCurlCommand } from '../services/harUtils';

const BrowserPanel: React.FC = () => {
    const { activeProject, createBrowserSession, deleteBrowserSession } = useProjectStore();
    const sessions = activeProject?.browserSessions || [];
    const backendUrl = activeProject?.backendUrl;
    
    // UI State
    const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || '');
    const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/todos/1'); 
    const [method, setMethod] = useState('GET');
    const [requestBody, setRequestBody] = useState<string>('');
    const [requestHeaders, setRequestHeaders] = useState<string>(''); // JSON string
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'PREVIEW' | 'JSON' | 'RAW'>('PREVIEW');
    const [newSessionName, setNewSessionName] = useState('');
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    // cURL Import State
    const [showCurlModal, setShowCurlModal] = useState(false);
    const [curlInput, setCurlInput] = useState('');

    // Confirmation State
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => {}
    });
    const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    // Response State
    const [responseContent, setResponseContent] = useState<string>('');
    const [responseType, setResponseType] = useState<string>(''); 
    const [responseStatus, setResponseStatus] = useState<number | null>(null);

    // Sync active session if list changes
    useEffect(() => {
        if (!activeSessionId && sessions.length > 0) {
            setActiveSessionId(sessions[0].id);
        }
    }, [sessions, activeSessionId]);

    const handleNavigate = async () => {
        if (!backendUrl) {
            setError("Backend URL is not configured. Configure it in Settings.");
            return;
        }
        if (!activeSessionId) {
            setError("No active session selected.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResponseStatus(null);
        setResponseContent('');
        setResponseType('');

        try {
            let headersParsed: Record<string, string> | undefined = undefined;
            if (requestHeaders.trim()) {
                try {
                    headersParsed = JSON.parse(requestHeaders);
                } catch {
                    setError("Invalid JSON for Request Headers.");
                    return;
                }
            }

            const result = await executeProxyRequest(backendUrl, {
                url,
                method,
                body: method !== 'GET' ? requestBody : undefined,
                headers: headersParsed,
            }, activeSessionId);

            setResponseContent(result.content || '');
            setResponseStatus(result.status);
            
            // Heuristic content-type detection
            let inferredType = 'text/plain';
            const contentTrimmed = (result.content || '').trim();
            if (contentTrimmed.startsWith('{') || contentTrimmed.startsWith('[')) inferredType = 'application/json';
            else if (contentTrimmed.startsWith('<')) inferredType = 'text/html';
            
            setResponseType(inferredType);
            
            // Auto-switch view mode
            if (inferredType === 'application/json') setViewMode('JSON');
            else if (inferredType === 'text/html') setViewMode('PREVIEW');
            else setViewMode('RAW');
            
        } catch (err: any) {
            console.error("Browser navigation error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };


    const isHtml = responseType.includes('text/html');
    const isJson = responseType.includes('application/json');

    const renderResponse = () => {
        if (isLoading) return <div className="flex items-center justify-center h-full text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading...</div>;
        if (error) return (
            <div className="flex flex-col items-center justify-center h-full text-red-400 p-8 text-center bg-red-900/10">
                <AlertCircle size={32} className="mb-4" />
                <h3 className="font-bold text-lg mb-2">Request Failed</h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed max-w-md mb-6">{error}</p>
                
                {backendUrl && (
                    <a 
                        href={backendUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-gray-600"
                    >
                        <ExternalLink size={16} /> Open Backend URL
                    </a>
                )}
                <p className="text-xs text-gray-500 mt-4">Opening the URL helps clear security warnings for DevTunnels.</p>
            </div>
        );
        if (!responseContent && responseStatus === null) return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Globe size={32} className="mb-2" />
                <p>Enter a URL and click "Go" to start browsing.</p>
            </div>
        );

        if (viewMode === 'RAW') {
            return <pre className="whitespace-pre-wrap text-xs font-mono p-4 text-gray-300">{responseContent}</pre>;
        }
        if (viewMode === 'JSON' && isJson) {
            try {
                const json = JSON.parse(responseContent);
                return <JsonViewer data={json} initialExpanded={true} />;
            } catch {
                return <pre className="whitespace-pre-wrap text-xs font-mono p-4 text-red-400">Invalid JSON: {responseContent}</pre>;
            }
        }
        if (viewMode === 'PREVIEW' && isHtml) {
            return (
                <iframe
                    title="Browser Preview"
                    srcDoc={responseContent}
                    sandbox="allow-scripts allow-forms allow-popups allow-pointer-lock allow-downloads"
                    className="w-full h-full border-0 bg-white"
                />
            );
        }
        // Fallback
        return <pre className="whitespace-pre-wrap text-xs font-mono p-4 text-gray-300">
            {isJson && `[JSON detected, switch to JSON tab]\n\n`}
            {isHtml && `[HTML detected, switch to Preview tab]\n\n`}
            {responseContent}
        </pre>;
    };

    const handleCreateSession = () => {
        if (newSessionName.trim()) {
            createBrowserSession(newSessionName.trim());
            setNewSessionName('');
            setIsCreatingSession(false);
        }
    };

    const requestDeleteSession = () => {
        const sessionName = sessions.find(s => s.id === activeSessionId)?.name || 'this session';
        setConfirmModal({
            isOpen: true,
            title: 'Delete Session',
            message: `Are you sure you want to delete "${sessionName}"?\nHistory for this session will be lost.`,
            onConfirm: () => {
                deleteBrowserSession(activeSessionId);
                closeConfirm();
            }
        });
    };

    const handleCurlImport = () => {
        try {
            const parsed = parseCurlCommand(curlInput);
            if (parsed.url) setUrl(parsed.url);
            if (parsed.method) setMethod(parsed.method);
            if (parsed.headers && Object.keys(parsed.headers).length > 0) {
                setRequestHeaders(JSON.stringify(parsed.headers, null, 2));
            }
            if (parsed.body) setRequestBody(parsed.body);
            
            setShowCurlModal(false);
            setCurlInput('');
        } catch (e) {
            alert("Failed to parse cURL command");
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-900 text-white relative">
            <ConfirmModal 
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
            />

            {/* cURL Modal */}
            {showCurlModal && (
                 <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                     <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 w-full max-w-2xl">
                         <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Terminal size={18} /> Import from cURL</h3>
                         <p className="text-sm text-gray-400 mb-4">Paste a standard cURL command to populate the browser fields.</p>
                         <textarea 
                             value={curlInput}
                             onChange={(e) => setCurlInput(e.target.value)}
                             placeholder="curl 'https://api.example.com/data' -H 'Authorization: Bearer...' --data '...'"
                             className="w-full h-32 bg-gray-900 border border-gray-600 rounded p-3 text-xs font-mono text-green-400 focus:outline-none focus:border-blue-500 resize-none mb-4"
                         />
                         <div className="flex justify-end gap-3">
                             <button onClick={() => setShowCurlModal(false)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">Cancel</button>
                             <button onClick={handleCurlImport} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 text-white">Import</button>
                         </div>
                     </div>
                 </div>
            )}

            {/* Top Bar - Session & Address */}
            <div className="p-3 border-b border-gray-700 bg-gray-800 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    {/* Session Selector */}
                    <div className="relative z-10">
                        <select 
                            value={activeSessionId}
                            onChange={(e) => setActiveSessionId(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 pr-8"
                        >
                            {sessions.map(session => (
                                <option key={session.id} value={session.id}>{session.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    <button 
                        onClick={() => setIsCreatingSession(true)}
                        className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors"
                        title="New Session"
                    >
                        <Plus size={16} />
                    </button>
                    {activeSessionId && sessions.length > 1 && ( 
                        <button 
                            onClick={requestDeleteSession}
                            className="p-1.5 bg-red-800/20 hover:bg-red-800/40 rounded text-red-400 transition-colors"
                            title="Delete Session"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    
                    <button 
                         onClick={() => setShowCurlModal(true)}
                         className="ml-auto flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-xs text-gray-300 hover:text-white transition-colors border border-gray-600"
                    >
                        <Terminal size={14} /> Import cURL
                    </button>
                </div>
                
                {isCreatingSession && (
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={newSessionName}
                            onChange={(e) => setNewSessionName(e.target.value)}
                            placeholder="New session name"
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSession(); }}
                        />
                        <button onClick={handleCreateSession} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-sm">Create</button>
                        <button onClick={() => setIsCreatingSession(false)} className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded text-sm">Cancel</button>
                    </div>
                )}


                {/* URL Bar */}
                <div className="flex items-center gap-2 mt-2">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(); }}
                        placeholder="https://example.com"
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none"
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                    <button
                        onClick={handleNavigate}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Go
                    </button>
                    <button
                        onClick={handleNavigate}
                        disabled={isLoading}
                        className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>

                {/* Request Body/Headers for POST/PUT */}
                {(method === 'POST' || method === 'PUT') && (
                    <div className="flex gap-2 mt-2">
                        <textarea
                            value={requestBody}
                            onChange={(e) => setRequestBody(e.target.value)}
                            placeholder="Request Body"
                            className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-y min-h-[60px]"
                        />
                         <textarea
                            value={requestHeaders}
                            onChange={(e) => setRequestHeaders(e.target.value)}
                            placeholder='Request Headers (JSON)'
                            className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-y min-h-[60px]"
                        />
                    </div>
                )}
            </div>

            {/* Response View Mode */}
            <div className="p-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between text-sm">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setViewMode('PREVIEW')} 
                        className={`px-3 py-1 rounded flex items-center gap-1 ${viewMode === 'PREVIEW' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        disabled={!isHtml && responseContent.length > 0 && !error && !isLoading}
                    >
                        <Eye size={14} /> Preview
                    </button>
                    <button 
                        onClick={() => setViewMode('JSON')} 
                        className={`px-3 py-1 rounded flex items-center gap-1 ${viewMode === 'JSON' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        disabled={!isJson && responseContent.length > 0 && !error && !isLoading}
                    >
                        <Code size={14} /> JSON
                    </button>
                    <button 
                        onClick={() => setViewMode('RAW')} 
                        className={`px-3 py-1 rounded flex items-center gap-1 ${viewMode === 'RAW' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        disabled={responseContent.length === 0 && !error && !isLoading}
                    >
                        <FileText size={14} /> Raw
                    </button>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs">Status:</span>
                    {responseStatus ? (
                        <span className={`font-bold ${responseStatus >= 200 && responseStatus < 300 ? 'text-green-400' : 'text-red-400'}`}>{responseStatus}</span>
                    ) : (
                        <span className="text-gray-500">N/A</span>
                    )}
                </div>
            </div>

            {/* Response Content */}
            <div className="flex-1 overflow-auto bg-gray-900">
                {renderResponse()}
            </div>
        </div>
    );
};

export default BrowserPanel;
