
import React, { useRef, useState } from 'react';
import { Download, Upload, Save, FileJson, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { HarEntryWrapper, KnowledgeGraphData, ChatMessage, ProjectBackup } from '../types';

interface SettingsPageProps {
  harEntries: HarEntryWrapper[];
  knowledgeData: KnowledgeGraphData;
  chatMessages: ChatMessage[];
  onImportProject: (backup: ProjectBackup) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ harEntries, knowledgeData, chatMessages, onImportProject }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // --- Export Logic ---

  const handleExportBackup = () => {
    const backup: ProjectBackup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      name: "HarMind_Backup",
      harEntries,
      knowledgeData,
      chatHistory: chatMessages
    };
    downloadJson(backup, `harmind-backup-${new Date().toISOString().slice(0,10)}.json`);
    showSuccess("Project backup exported successfully.");
  };

  const handleExportHar = () => {
    // Reconstruct a standard HAR structure roughly
    const harLog = {
      log: {
        version: "1.2",
        creator: { name: "HarMind", version: "1.0" },
        entries: harEntries.map(({ _index, _id, _selected, _groupKey, ...entry }) => entry)
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


  // --- Import Logic ---

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Basic validation
        if (!parsed.harEntries || !parsed.knowledgeData) {
          throw new Error("Invalid backup file format. Missing HAR entries or Knowledge Graph data.");
        }

        onImportProject(parsed as ProjectBackup);
        setImportError(null);
        showSuccess("Project restored successfully.");
      } catch (err: any) {
        setImportError("Failed to import backup: " + err.message);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 text-white p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2 text-gray-100">Settings & Data Management</h1>
        <p className="text-gray-400 mb-8">Manage your project data, create backups, and export extracted insights.</p>

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
            
            {/* Backup Section */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
                        <Save size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Project Backup</h3>
                        <p className="text-xs text-gray-400">Save full state (HAR, Graph, Chat)</p>
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

            {/* Export Data Section */}
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
                        <span className="flex items-center gap-2"><Share2Icon /> Knowledge Graph</span>
                        <Download size={16} />
                    </button>
                </div>
            </div>

            {/* Stats Section */}
            <div className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Current Project Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Requests" value={harEntries.length} />
                    <StatCard label="Selected Requests" value={harEntries.filter(e => e._selected).length} />
                    <StatCard label="Extracted Entities" value={knowledgeData.nodes.length} />
                    <StatCard label="Chat Messages" value={chatMessages.length} />
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

// Helper for icon since Share2 is not exported directly as a component usually in standard Lucide imports if used as variable, 
// but here we used lucide-react. Let's just use a simple SVG or import Share2 from lucide-react in the file.
import { Share2 } from 'lucide-react';
const Share2Icon = () => <Share2 size={18} />;

const StatCard = ({ label, value }: { label: string; value: number }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
);

export default SettingsPage;
