
import React, { useState, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { FolderPlus, Trash2, FolderOpen, HardDrive, FileText, Activity, Upload, Edit2, X, Check, ArrowRight, PlayCircle } from 'lucide-react';
import { ProjectMetadata } from '../types';
import { DEMO_EXAMPLES, DemoProject } from '../demo/examples';
import ConfirmModal from './ConfirmModal';

const ProjectManager: React.FC = () => {
    const { projects, createProject, openProject, deleteProject, importProjectFromFile, createProjectFromBackup, renameProject, isLoading } = useProjectStore();
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    
    // Rename state
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [initialFile, setInitialFile] = useState<File | null>(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => {}
    });

    const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        
        await createProject(newProjectName, initialFile || undefined);
        setIsCreating(false);
        setNewProjectName('');
        setInitialFile(null);
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await importProjectFromFile(file);
        }
        e.target.value = '';
    };

    const startRename = (project: ProjectMetadata) => {
        setRenamingId(project.id);
        setRenameValue(project.name);
    };

    const submitRename = async () => {
        if (renamingId && renameValue.trim()) {
            await renameProject(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    };

    const requestDelete = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Project',
            message: 'Are you sure you want to delete this project?\nThis action cannot be undone.',
            onConfirm: () => {
                deleteProject(id);
                closeConfirm();
            }
        });
    };

    const requestDemoImport = (demo: DemoProject) => {
        setConfirmModal({
            isOpen: true,
            title: 'Import Demo',
            message: `Do you want to import "${demo.title}"?\nThis will create a new project in your workspace.`,
            onConfirm: () => {
                createProjectFromBackup(demo.data);
                closeConfirm();
            }
        });
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-900 text-white p-8 overflow-y-auto">
            <ConfirmModal 
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
            />

            <div className="max-w-7xl mx-auto w-full">
                <header className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Activity className="text-blue-500" />
                            HarMind Projects
                        </h1>
                        <p className="text-gray-400 mt-1">Manage your analysis workspaces locally.</p>
                    </div>
                    <div className="flex gap-3">
                        <input 
                            type="file" 
                            ref={importInputRef} 
                            accept=".json" 
                            onChange={handleImportFile} 
                            className="hidden" 
                        />
                        <button 
                            onClick={handleImportClick}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors border border-gray-700"
                        >
                            <Upload size={18} /> Import Project
                        </button>
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-blue-900/20"
                        >
                            <FolderPlus size={18} /> New Project
                        </button>
                    </div>
                </header>

                {/* Demos Section */}
                <div className="mb-10">
                    <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                        <PlayCircle size={18} className="text-purple-400" /> Start with a Demo
                    </h2>
                    <div className="flex overflow-x-auto snap-x gap-4 pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {DEMO_EXAMPLES.map((demo) => (
                            <div 
                                key={demo.id}
                                className={`
                                    group flex-shrink-0 w-80 h-48 bg-gradient-to-br ${demo.colorFrom} ${demo.colorTo} 
                                    rounded-2xl p-6 relative overflow-hidden cursor-pointer shadow-xl snap-start
                                    transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1
                                `}
                                onClick={() => requestDemoImport(demo)}
                            >
                                <div className="relative z-10 h-full flex flex-col justify-between">
                                    <div>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {demo.tags.map(tag => (
                                                <span key={tag} className="text-[10px] uppercase font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{tag}</span>
                                            ))}
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{demo.title}</h3>
                                        <p className="text-white/80 text-sm line-clamp-2">{demo.description}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                                        Import & Open <ArrowRight size={16} />
                                    </div>
                                </div>
                                
                                {/* Decorational Circles */}
                                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
                                <div className="absolute top-0 right-0 w-24 h-24 bg-black/10 rounded-full blur-xl" />
                            </div>
                        ))}
                    </div>
                </div>

                {isCreating && (
                    <div className="mb-8 bg-gray-800 border border-gray-700 rounded-xl p-6 animate-in slide-in-from-top-4 shadow-2xl">
                        <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Project Name</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={newProjectName} 
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="e.g., Q1 Audit Analysis"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Initial HAR File (Optional)</label>
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-700 bg-gray-900/50 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors flex items-center justify-center gap-2 text-gray-400"
                                >
                                    {initialFile ? (
                                        <span className="text-green-400 flex items-center gap-2">
                                            <FileText size={16} /> {initialFile.name}
                                        </span>
                                    ) : (
                                        <>Click to select a .har file</>
                                    )}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        accept=".har" 
                                        onChange={(e) => setInitialFile(e.target.files?.[0] || null)} 
                                        className="hidden" 
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCreating(false)} 
                                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={!newProjectName.trim()}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12 text-gray-500">Loading projects...</div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
                        <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                            <FolderOpen size={32} />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-300">No Projects Found</h3>
                        <p className="text-gray-500 mt-2">Create a new project or start with a demo above.</p>
                    </div>
                ) : (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                            <HardDrive size={18} className="text-blue-400" /> Your Projects
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map(project => (
                                <ProjectCard 
                                    key={project.id} 
                                    project={project} 
                                    onOpen={openProject} 
                                    onDelete={() => requestDelete(project.id)}
                                    onRename={() => startRename(project)}
                                    isRenaming={renamingId === project.id}
                                    renameValue={renameValue}
                                    setRenameValue={setRenameValue}
                                    submitRename={submitRename}
                                    cancelRename={() => setRenamingId(null)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ProjectCardProps { 
    project: ProjectMetadata; 
    onOpen: (id: string) => void; 
    onDelete: () => void; 
    onRename: () => void;
    isRenaming: boolean;
    renameValue: string;
    setRenameValue: (val: string) => void;
    submitRename: () => void;
    cancelRename: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
    project, onOpen, onDelete, onRename, isRenaming, renameValue, setRenameValue, submitRename, cancelRename 
}) => {
    return (
        <div className="group bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-xl p-5 transition-all hover:shadow-xl hover:-translate-y-1 relative">
            <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-gray-700 rounded-lg group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-colors">
                    <FolderOpen size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRename(); }}
                        className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                        title="Rename"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            
            {isRenaming ? (
                <div className="mb-2 flex items-center gap-2">
                    <input 
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if(e.key === 'Enter') submitRename(); if(e.key === 'Escape') cancelRename(); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-gray-900 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                    />
                    <button onClick={(e) => { e.stopPropagation(); submitRename(); }} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); cancelRename(); }} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                </div>
            ) : (
                <h3 className="text-lg font-bold text-gray-100 mb-1 truncate cursor-pointer" title={project.name} onClick={() => onOpen(project.id)}>
                    {project.name}
                </h3>
            )}
            
            <div className="text-xs text-gray-500 mb-4">Updated {new Date(project.updatedAt).toLocaleDateString()}</div>
            
            <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                <div className="bg-gray-900 rounded p-2 text-center">
                    <div className="font-semibold text-gray-300">{project.requestCount}</div>
                    <div className="text-gray-600 scale-90">Reqs</div>
                </div>
                <div className="bg-gray-900 rounded p-2 text-center">
                    <div className="font-semibold text-gray-300">{project.entityCount}</div>
                    <div className="text-gray-600 scale-90">Nodes</div>
                </div>
                <div className="bg-gray-900 rounded p-2 text-center">
                    <div className="font-semibold text-gray-300">{formatBytes(project.size)}</div>
                    <div className="text-gray-600 scale-90">Size</div>
                </div>
            </div>

            <button 
                onClick={() => onOpen(project.id)}
                className="w-full bg-gray-700 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
                Open Project
            </button>
        </div>
    );
};

// Helper for formatting bytes
const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default ProjectManager;
