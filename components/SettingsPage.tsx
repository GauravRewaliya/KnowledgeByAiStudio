
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Save, FileJson, Database, AlertCircle, CheckCircle2, Server, ExternalLink } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { ProjectBackup } from '../types';
import { Share2 } from 'lucide-react';
import { checkBackendHealth } from '../services/backendService';
import { initNeo4jDriver } from '../services/neo4jService';

const SettingsPage: React.FC = () => {
  const { activeProject, importProjectData, setBackendUrl, setNeo4jConfig } = useProjectStore();
  
  // Guard clause if no project active (though App router handles this)
  const harEntries = activeProject?.harEntries || [];
  const knowledgeData = activeProject?.knowledgeData || { nodes: [], links: [] };
  const chatMessages = activeProject?.chatHistory || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'fail' | null>(null);
  const [neo4jStatus, setNeo4jStatus] = useState<'checking' | 'ok' | 'fail' | null>(null);
  
  const [localUrl, setLocalUrl] = useState(activeProject?.backendUrl || '');
  
  const [neo4jUri, setNeo4jUri] = useState(activeProject?.neo4jConfig?.uri || '');
  const [neo4jUser, setNeo4jUser] = useState(activeProject?.neo4jConfig?.user || '');
  const [neo4jPassword, setNeo4jPassword] = useState(activeProject?.neo4jConfig?.password || '');
  const [neo4jBrowserUrl, setNeo4jBrowserUrl] = useState(activeProject?.neo4jConfig?.browserUrl || '');

  useEffect(() => {
      setLocalUrl(activeProject?.backendUrl || '');
      if (activeProject?.neo4jConfig) {
          setNeo4jUri(activeProject.neo4jConfig.uri);
          setNeo4jUser(activeProject.neo4jConfig.user);
          setNeo4jPassword(activeProject.neo4jConfig.password || '');
          setNeo4jBrowserUrl(activeProject.neo4jConfig.browserUrl || '');
      }
  }, [activeProject]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // --- Export Logic ---

  const handleExportBackup = () => {
    const backup: ProjectBackup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      name: activeProject?.name || "HarMind_Backup",
      harEntries,
      knowledgeData,
      chatHistory: chatMessages,
      scrapingEntries: activeProject?.scrapingEntries,
      neo4jConfig: activeProject?.neo4jConfig,
      backendUrl: activeProject?.backendUrl
    };
    downloadJson(backup, `harmind-backup-${activeProject?.name.replace(/\s+/g,'_')}-${new Date().toISOString().slice(0,10)}.json`);
    showSuccess("Project backup exported successfully.");
  };

  const handleExportHar = () => {
    const harLog = {
      log: {
        version: "1.2",
        creator: { name: "HarMind", version: "1.0" },
        entries: harEntries.map(({ _index, _id, _selected, _groupKey, _harId, _harName, ...entry }) => entry)
      }
    };
    downloadJson(harLog, `filtered-traffic-${new Date().toISOString().slice(0,10)}.har`);
    showSuccess("Filtered HAR file exported.");
  };

  const handleExportGraph = () => {
    downloadJson(knowledgeData, `knowledge-graph-${new Date().toISOString().slice(0,10)}.json`);
    showSuccess("Knowledge Graph exported.");
  };

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveBackend = async () => {
      setBackendUrl(localUrl);
      setBackendStatus('checking');
      const isOk = await checkBackendHealth(localUrl);
      setBackendStatus(isOk ? 'ok' : 'fail');
      if (isOk) showSuccess("Backend URL saved and verified.");
      else setImportError("Backend unreachable. Saved anyway.");
      setTimeout(() => setImportError(null), 3000);
  };

  const handleSaveNeo4j = async () => {
      setNeo4jConfig({
          uri: neo4jUri,
          user: neo4jUser,
          password: neo4jPassword,
          browserUrl: neo4jBrowserUrl
      });
      setNeo4jStatus('checking');
      const isConnected = await initNeo4jDriver(neo4jUri, neo4jUser, neo4jPassword);
      setNeo4jStatus(isConnected ? 'ok' : 'fail');
      
      if (isConnected) showSuccess("Neo4j Connected Successfully.");
      else setImportError("Could not connect to Neo4j. Check console/settings.");
      setTimeout(() => setImportError(null), 3000);
  };

  const openNeo4jAdmin = () => {
      if (neo4jBrowserUrl) {
          window.open(neo4jBrowserUrl, '_blank');
      } else {
          alert("Please configure the Neo4j Browser URL first.");
      }
  };

  // --- Import Logic ---

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.harEntries || !parsed.knowledgeData) {
          throw new Error("Invalid backup file format. Missing HAR entries or Knowledge Graph data.");
        }

        await importProjectData(parsed as ProjectBackup);
        setImportError(null);
        showSuccess("Project restored successfully.");
      } catch (err: any) {
        setImportError("Failed to import backup: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!activeProject) return <div>No active project.</div>;

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 text-white p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2 text-gray-100">Settings & Data Management</h1>
        <p className="text-gray-400 mb-8">Manage data for project: <span className="text-blue-400 font-semibold">{activeProject.name}</span></p>

        {successMsg && (
            <div className="mb-6 bg-green-900/30 border border-green-800 text-green-300 px-4 py-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 size={20} />
                {successMsg}
            </div>
        )}

        {importError && (
            <div className="mb-6 bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                {importError}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Neo4j Config */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Neo4j Database</h3>
                            <p className="text-xs text-gray-400">Connect to external graph database</p>
                        </div>
                    </div>
                    {neo4jStatus && (
                        <div className={`text-xs px-2 py-1 rounded font-bold uppercase ${neo4jStatus === 'ok' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                            {neo4jStatus}
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="text-xs text-gray-400 mb-1 block">Bolt URI (e.g. bolt://localhost:7687)</label>
                        <input 
                            type="text" 
                            value={neo4jUri}
                            onChange={(e) => setNeo4jUri(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Username</label>
                        <input 
                            type="text" 
                            value={neo4jUser}
                            onChange={(e) => setNeo4jUser(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Password</label>
                        <input 
                            type="password" 
                            value={neo4jPassword}
                            onChange={(e) => setNeo4jPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs text-gray-400 mb-1 block">Browser URL (for Admin redirection)</label>
                        <input 
                            type="text" 
                            value={neo4jBrowserUrl}
                            onChange={(e) => setNeo4jBrowserUrl(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                            placeholder="http://localhost:7474"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                    <button 
                        onClick={handleSaveNeo4j}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        Save & Connect
                    </button>
                    <button 
                        onClick={openNeo4jAdmin}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-gray-600"
                    >
                         Open Admin <ExternalLink size={14} />
                    </button>
                </div>
            </div>

            {/* Backend Proxy */}
            <div className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-600/20 text-green-400 rounded-lg">
                        <Server size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Backend Proxy</h3>
                        <p className="text-xs text-gray-400">Configure proxy for requests (e.g. Browser, cURL)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        type="text" 
                        value={localUrl}
                        onChange={(e) => setLocalUrl(e.target.value)}
                        placeholder="http://localhost:4999"
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
                    />
                    {localUrl && (
                        <a 
                            href={localUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors border border-gray-600"
                            title="Open in new tab (required for DevTunnels)"
                        >
                            <ExternalLink size={20} />
                        </a>
                    )}
                    <button 
                        onClick={handleSaveBackend}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        Save
                    </button>
                </div>
                {backendStatus && (
                    <div className="mt-2 text-xs flex items-center gap-1">
                        Status: 
                        {backendStatus === 'checking' && <span className="text-yellow-400">Checking...</span>}
                        {backendStatus === 'ok' && <span className="text-green-400">Connected</span>}
                        {backendStatus === 'fail' && <span className="text-red-400">Unreachable</span>}
                    </div>
                )}
            </div>

            {/* Backup & Data */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
                        <Save size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Project Backup</h3>
                        <p className="text-xs text-gray-400">Save full state (HAR, Graph, Chat, DB)</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={handleExportBackup}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg transition-colors font-medium"
                    >
                        <Download size={18} /> Download Backup (.json)
                    </button>
                    <div className="relative">
                        <button 
                            onClick={handleImportClick}
                            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded-lg transition-colors border border-gray-600"
                        >
                            <Upload size={18} /> Restore from Backup
                        </button>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".json"
                            onChange={handleFileChange}
                            className="hidden" 
                        />
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-600/20 text-purple-400 rounded-lg">
                        <Database size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Data Export</h3>
                        <p className="text-xs text-gray-400">Export specific components</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={handleExportHar}
                        disabled={harEntries.length === 0}
                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors border border-gray-600"
                    >
                        <span className="flex items-center gap-2"><FileJson size={18} /> Filtered HAR File</span>
                        <Download size={16} />
                    </button>
                    <button 
                        onClick={handleExportGraph}
                        disabled={knowledgeData.nodes.length === 0}
                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors border border-gray-600"
                    >
                        <span className="flex items-center gap-2"><Share2 size={18} /> Knowledge Graph</span>
                        <Download size={16} />
                    </button>
                </div>
            </div>

            <div className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Current Project Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Requests" value={harEntries.length} />
                    <StatCard label="Selected Requests" value={harEntries.filter(e => e._selected).length} />
                    <StatCard label="DB Entries" value={activeProject?.scrapingEntries?.length || 0} />
                    <StatCard label="Chat Messages" value={chatMessages.length} />
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: number }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
);

export default SettingsPage;
