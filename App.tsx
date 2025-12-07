
import React, { useEffect, useRef } from 'react';
import { Upload, Share2, MessageSquare, Activity, BarChart2, FlaskConical, Settings, ArrowLeft } from 'lucide-react';
import HarViewer from './components/HarViewer';
import KnowledgeGraph from './components/KnowledgeGraph';
import ChatInterface from './components/ChatInterface';
import TestToolPage from './components/TestToolPage'; 
import SettingsPage from './components/SettingsPage';
import ProjectManager from './components/ProjectManager';
import { useProjectStore } from './store/projectStore';
import { ViewMode, ExtractedEntity } from './types';
import { allToolDefinitions } from './tools'; 

const App: React.FC = () => {
  const { 
      activeProject, 
      viewMode, 
      setViewMode, 
      closeProject, 
      init,
      addHarFile
  } = useProjectStore();
  
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize store on mount
  useEffect(() => {
      init();
  }, [init]);

  const handleAddHar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) addHarFile(file);
    event.target.value = '';
  };

  const triggerAddHar = () => {
    addFileInputRef.current?.click();
  };

  // If no active project, show Project Manager
  if (!activeProject) {
      return (
          <div className="h-screen w-screen bg-gray-900">
             <ProjectManager />
          </div>
      );
  }

  // Derive counts from active project
  const harEntries = activeProject.harEntries;
  const knowledgeData = activeProject.knowledgeData;

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-16 bg-gray-950 border-r border-gray-800 flex flex-col items-center py-4 gap-6 z-20 flex-shrink-0">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20 cursor-pointer" onClick={closeProject} title="Back to Projects">
            <ArrowLeft className="text-white w-6 h-6" />
        </div>
        
        <div className="flex flex-col gap-4 w-full items-center">
            {/* Upload now just triggers Add HAR since project is open */}
            <NavButton 
                active={viewMode === ViewMode.UPLOAD} 
                onClick={triggerAddHar}
                icon={<Upload size={20} />} 
                label="Add HAR File" 
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
        
        {/* Hidden Input for Adding HARs */}
        <input 
            type="file" 
            ref={addFileInputRef} 
            onChange={handleAddHar} 
            accept=".har" 
            className="hidden" 
        />

        {/* View Routing */}
        {viewMode === ViewMode.EXPLORE && (
             harEntries.length > 0 ? (
                <div className="flex-1 flex w-full overflow-hidden">
                    <HarViewer onAddHar={triggerAddHar} />
                </div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                    <p className="mb-4">This project has no data yet.</p>
                    <button onClick={triggerAddHar} className="bg-blue-600 px-4 py-2 rounded text-white">Add HAR File</button>
                </div>
             )
        )}

        {viewMode === ViewMode.GRAPH && (
            <div className="flex-1 relative">
                <KnowledgeGraph />
                 {/* Floating Stats */}
                 <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur p-3 rounded-lg shadow-lg border border-gray-700 text-xs text-gray-300">
                    <div className="font-bold mb-1">Graph Stats</div>
                    <div>Nodes: <span className="text-white">{knowledgeData.nodes.length}</span></div>
                    <div>Links: <span className="text-white">{knowledgeData.links.length}</span></div>
                 </div>
            </div>
        )}

        {viewMode === ViewMode.TEST_TOOLS && (
            <div className="flex-1 flex w-full overflow-hidden">
                <TestToolPage />
            </div>
        )}

        {viewMode === ViewMode.SETTINGS && (
            <div className="flex-1 flex w-full overflow-hidden">
                <SettingsPage />
            </div>
        )}

        {/* Chat Drawer */}
        <div className={`
            absolute top-0 right-0 h-full bg-gray-900 border-l border-gray-700 shadow-2xl z-30 flex flex-col transition-all duration-300 ease-in-out
            ${isChatOpen ? 'translate-x-0 visible opacity-100' : 'invisible opacity-0'}
            w-full md:w-[450px]
        `}>
            <ChatInterface onClose={() => setIsChatOpen(false)} />
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
            <span className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-700 transform rotate-45"></span>
        </span>
    </button>
);

export default App;
