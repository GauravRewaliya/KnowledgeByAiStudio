
import React, { useState } from 'react';
import { Upload, FileText, Share2, MessageSquare, Activity, BarChart2, FlaskConical, Settings } from 'lucide-react';
import HarViewer from './components/HarViewer';
import DataTransformer from './components/DataTransformer'; // Keep for now, might deprecate fully later
import KnowledgeGraph from './components/KnowledgeGraph';
import ChatInterface from './components/ChatInterface';
import TestToolPage from './components/TestToolPage'; 
import SettingsPage from './components/SettingsPage';
import { HarFile, HarEntryWrapper, ExtractedEntity, KnowledgeGraphData, ViewMode, ChatMessage, ProjectBackup } from './types';
import { allToolDefinitions } from './tools'; 

const App: React.FC = () => {
  const [harEntries, setHarEntries] = useState<HarEntryWrapper[]>([]);
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.UPLOAD);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Lifted Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am ready to analyze your HAR file. I can inspect requests, understand the data structure, and extract specific information into the Knowledge Graph.' }
  ]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed: HarFile = JSON.parse(content);
          
          // Enrich entries with ID and selection state
          const wrapped: HarEntryWrapper[] = parsed.log.entries.map((entry, idx) => ({
            ...entry,
            _index: idx,
            _id: `entry-${idx}-${Math.random().toString(36).substr(2, 9)}`,
            _selected: false // Default to unselected? Or all selected? Let's say unselected for manual or all for auto.
          }));
          
          setHarEntries(wrapped);
          setViewMode(ViewMode.EXPLORE);
          setUploadError(null);
        } catch (error) {
          setUploadError("Invalid HAR file format. Please try again.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImportProject = (backup: ProjectBackup) => {
      setHarEntries(backup.harEntries || []);
      setKnowledgeData(backup.knowledgeData || { nodes: [], links: [] });
      setChatMessages(backup.chatHistory || []);
      setViewMode(ViewMode.EXPLORE);
  };

  const handleAddEntity = (newEntities: ExtractedEntity[]) => {
    setKnowledgeData(prev => {
        const nextNodes = [...prev.nodes];
        const nextLinks = [...prev.links];
        
        let addedCount = 0;
        newEntities.forEach(entity => {
            if (!nextNodes.find(n => n.id === entity.id)) {
                nextNodes.push(entity);
                addedCount++;
            }
            
            // Auto-linking heuristics based on IDs found in data
            // Example: if entity has 'projectId' and we have a 'Project' node with that ID
            Object.entries(entity.data).forEach(([key, value]) => {
                if (typeof value === 'string' && (key.endsWith('Id') || key === 'id')) {
                    const targetNode = nextNodes.find(n => n.id === value && n.id !== entity.id);
                    if (targetNode) {
                         nextLinks.push({ source: entity.id, target: targetNode.id, label: key });
                    }
                    // Reverse check
                    const sourceNode = nextNodes.find(n => n.data.id === value && n.id !== entity.id);
                    if (sourceNode) {
                        nextLinks.push({ source: sourceNode.id, target: entity.id, label: key });
                    }
                }
            });
        });
        return { nodes: nextNodes, links: nextLinks };
    });
    // Optional: Switch to graph view or notify
    if (isChatOpen) {
       // Chat handles notification via text
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-16 bg-gray-950 border-r border-gray-800 flex flex-col items-center py-4 gap-6 z-20 flex-shrink-0">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">
            <Activity className="text-white w-6 h-6" />
        </div>
        
        <div className="flex flex-col gap-4 w-full items-center">
            <NavButton 
                active={viewMode === ViewMode.UPLOAD} 
                onClick={() => setViewMode(ViewMode.UPLOAD)} 
                icon={<Upload size={20} />} 
                label="Upload HAR" 
            />
            <NavButton 
                active={viewMode === ViewMode.EXPLORE} 
                onClick={() => setViewMode(ViewMode.EXPLORE)} 
                disabled={harEntries.length === 0}
                icon={<BarChart2 size={20} />} 
                label="Explore & Clean" 
            />
            <NavButton 
                active={viewMode === ViewMode.GRAPH} 
                onClick={() => setViewMode(ViewMode.GRAPH)} 
                disabled={harEntries.length === 0}
                icon={<Share2 size={20} />} 
                label="Knowledge Graph" 
            />
            <NavButton 
                active={viewMode === ViewMode.TEST_TOOLS} 
                onClick={() => setViewMode(ViewMode.TEST_TOOLS)} 
                disabled={harEntries.length === 0 || allToolDefinitions.length === 0}
                icon={<FlaskConical size={20} />} 
                label="Test Tools" 
            />
            <NavButton 
                active={viewMode === ViewMode.SETTINGS} 
                onClick={() => setViewMode(ViewMode.SETTINGS)} 
                icon={<Settings size={20} />} 
                label="Settings & Backup" 
            />
        </div>

        <div className="mt-auto mb-4">
             <NavButton 
                active={isChatOpen} 
                onClick={() => setIsChatOpen(!isChatOpen)} 
                disabled={harEntries.length === 0}
                icon={<MessageSquare size={20} />} 
                label="AI Agent" 
            />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {viewMode === ViewMode.UPLOAD && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-900">
                <div className="max-w-md w-full">
                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-12 hover:border-blue-500 transition-colors bg-gray-800/30 group">
                        <div className="bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                            <Upload className="h-8 w-8 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-white">Upload HAR File</h2>
                        <p className="text-gray-400 mb-8 text-sm">
                            Drag & drop your network log (.har) here to begin analysis.
                        </p>
                        <label className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors font-medium inline-block">
                            Select File
                            <input type="file" accept=".har" onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>
                    {uploadError && (
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-800 text-red-400 rounded text-sm">
                            {uploadError}
                        </div>
                    )}
                </div>
            </div>
        )}

        {viewMode === ViewMode.EXPLORE && harEntries.length > 0 && (
            <div className="flex-1 flex w-full overflow-hidden">
                <HarViewer 
                    entries={harEntries} 
                    setEntries={setHarEntries}
                />
            </div>
        )}

        {viewMode === ViewMode.GRAPH && (
            <div className="flex-1 relative">
                <KnowledgeGraph 
                    data={knowledgeData} 
                    onNodeClick={(node) => console.log('Clicked node', node)} 
                />
                 {/* Floating Stats */}
                 <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur p-3 rounded-lg shadow-lg border border-gray-700 text-xs text-gray-300">
                    <div className="font-bold mb-1">Graph Stats</div>
                    <div>Nodes: <span className="text-white">{knowledgeData.nodes.length}</span></div>
                    <div>Links: <span className="text-white">{knowledgeData.links.length}</span></div>
                 </div>
            </div>
        )}

        {viewMode === ViewMode.TEST_TOOLS && harEntries.length > 0 && (
            <div className="flex-1 flex w-full overflow-hidden">
                <TestToolPage harEntries={harEntries} />
            </div>
        )}

        {viewMode === ViewMode.SETTINGS && (
            <div className="flex-1 flex w-full overflow-hidden">
                <SettingsPage 
                    harEntries={harEntries}
                    knowledgeData={knowledgeData}
                    chatMessages={chatMessages}
                    onImportProject={handleImportProject}
                />
            </div>
        )}

        {/* Chat Drawer */}
        <div className={`
            absolute top-0 right-0 h-full bg-gray-900 border-l border-gray-700 shadow-2xl z-30 flex flex-col transition-all duration-300 ease-in-out
            ${isChatOpen ? 'translate-x-0 visible opacity-100' : 'invisible opacity-0'}
            w-full md:w-[450px]
        `}>
            {/* The ChatInterface component now handles its own close button */}
            <ChatInterface 
                harData={harEntries} 
                messages={chatMessages}
                setMessages={setChatMessages}
                onExtractData={handleAddEntity}
                onClose={() => setIsChatOpen(false)} // Pass the close handler
            />
        </div>

      </main>
    </div>
  );
};

const NavButton = ({ icon, label, onClick, active, disabled }: any) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`
            p-3 rounded-xl transition-all relative group
            ${active ? 'bg-blue-600/20 text-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
        `}
    >
        {icon}
        <span className="absolute left-16 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700 shadow-xl">
            {label}
            {/* Little triangle arrow */}
            <span className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-700 transform rotate-45"></span>
        </span>
    </button>
);

export default App;
