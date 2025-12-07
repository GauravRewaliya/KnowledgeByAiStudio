
import { create } from 'zustand';
import { ProjectState, ProjectData, ProjectMetadata, ViewMode, HarFile, HarEntryWrapper, KnowledgeGraphData, ChatMessage, ProjectBackup } from '../types';
import { storageService } from '../services/storageService';

// Debounce helper for auto-save
let saveTimeout: any = null;
const debouncedSave = (project: ProjectData) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        storageService.saveProject(project).catch(console.error);
    }, 1000);
};

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    activeProjectId: null,
    activeProject: null,
    viewMode: ViewMode.PROJECTS,
    isLoading: false,
    error: null,

    init: async () => {
        try {
            set({ isLoading: true });
            const projects = await storageService.getAllMetadata();
            // Sort by updated recently
            projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            set({ projects, isLoading: false });
        } catch (e: any) {
            set({ error: "Failed to load projects: " + e.message, isLoading: false });
        }
    },

    createProject: async (name: string, initialHarFile?: File) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        
        let harEntries: HarEntryWrapper[] = [];
        
        if (initialHarFile) {
            try {
                const text = await initialHarFile.text();
                const parsed: HarFile = JSON.parse(text);
                const harId = Math.random().toString(36).substr(2, 9);
                harEntries = parsed.log.entries.map((entry, idx) => ({
                    ...entry,
                    _index: idx,
                    _id: `entry-${harId}-${idx}`,
                    _selected: false,
                    _harId: harId,
                    _harName: initialHarFile.name
                }));
            } catch (e) {
                console.error("Failed to parse initial HAR", e);
                // Continue with empty project but show error? 
                // For now just continue
            }
        }

        const newProject: ProjectData = {
            id,
            name,
            createdAt: now,
            updatedAt: now,
            requestCount: harEntries.length,
            entityCount: 0,
            size: 0,
            harEntries,
            knowledgeData: { nodes: [], links: [] },
            chatHistory: [{ role: 'model', text: 'Project created. Ready to analyze.' }]
        };

        await storageService.saveProject(newProject);
        
        set(state => ({
            projects: [newProject, ...state.projects],
            activeProjectId: id,
            activeProject: newProject,
            viewMode: ViewMode.EXPLORE
        }));
    },

    importProjectFromFile: async (file: File) => {
        try {
            set({ isLoading: true });
            const text = await file.text();
            const backup: ProjectBackup = JSON.parse(text);
            
            if (!backup.harEntries || !backup.knowledgeData) {
                throw new Error("Invalid backup file format");
            }

            const id = crypto.randomUUID();
            const now = new Date().toISOString();

            const newProject: ProjectData = {
                id,
                name: backup.name || file.name.replace('.json', '') || 'Imported Project',
                createdAt: backup.timestamp || now,
                updatedAt: now,
                requestCount: backup.harEntries.length,
                entityCount: backup.knowledgeData.nodes.length,
                size: 0, // Will be calculated by saveProject
                harEntries: backup.harEntries,
                knowledgeData: backup.knowledgeData,
                chatHistory: backup.chatHistory || []
            };

            await storageService.saveProject(newProject);
            
            // Refresh list and add new project
            const projects = await storageService.getAllMetadata();
            projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            
            set({ projects, isLoading: false });
        } catch (e: any) {
            set({ error: "Failed to import project: " + e.message, isLoading: false });
        }
    },

    renameProject: async (id: string, newName: string) => {
        try {
            const project = await storageService.getProject(id);
            if (!project) return;

            const updatedProject = { ...project, name: newName, updatedAt: new Date().toISOString() };
            await storageService.saveProject(updatedProject);

            // Update state list
            set(state => ({
                projects: state.projects.map(p => p.id === id ? { ...p, name: newName, updatedAt: updatedProject.updatedAt } : p)
            }));

            // If it's the active project, update it too
            if (get().activeProjectId === id) {
                set({ activeProject: updatedProject });
            }

        } catch (e: any) {
            console.error("Failed to rename project", e);
        }
    },

    openProject: async (id: string) => {
        try {
            set({ isLoading: true, error: null });
            const project = await storageService.getProject(id);
            if (!project) throw new Error("Project not found");
            
            set({ 
                activeProjectId: id, 
                activeProject: project, 
                viewMode: ViewMode.EXPLORE,
                isLoading: false 
            });
        } catch (e: any) {
            set({ error: e.message, isLoading: false });
        }
    },

    closeProject: () => {
        set({ 
            activeProjectId: null, 
            activeProject: null, 
            viewMode: ViewMode.PROJECTS 
        });
        // Refresh list to show updated stats
        get().init(); 
    },

    deleteProject: async (id: string) => {
        if (get().activeProjectId === id) {
            get().closeProject();
        }
        await storageService.deleteProject(id);
        set(state => ({
            projects: state.projects.filter(p => p.id !== id)
        }));
    },

    setViewMode: (mode: ViewMode) => {
        set({ viewMode: mode });
    },

    // --- Active Project Data Actions ---

    addHarFile: async (file: File) => {
        const store = get();
        if (!store.activeProject) return;

        try {
            const text = await file.text();
            const parsed: HarFile = JSON.parse(text);
            const harId = Math.random().toString(36).substr(2, 9);
            const currentEntries = store.activeProject.harEntries;
            
            const newEntries: HarEntryWrapper[] = parsed.log.entries.map((entry, idx) => ({
                ...entry,
                _index: currentEntries.length + idx,
                _id: `entry-${harId}-${idx}`,
                _selected: false,
                _harId: harId,
                _harName: file.name
            }));

            const updatedProject = {
                ...store.activeProject,
                harEntries: [...currentEntries, ...newEntries],
                updatedAt: new Date().toISOString()
            };

            set({ activeProject: updatedProject });
            debouncedSave(updatedProject);
        } catch (e: any) {
            set({ error: "Failed to add HAR file: " + e.message });
            setTimeout(() => set({ error: null }), 3000);
        }
    },

    setHarEntries: (entries: HarEntryWrapper[]) => {
        const store = get();
        if (!store.activeProject) return;

        const updatedProject = {
            ...store.activeProject,
            harEntries: entries,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    setKnowledgeData: (dataOrFn) => {
        const store = get();
        if (!store.activeProject) return;

        const newData = typeof dataOrFn === 'function' ? dataOrFn(store.activeProject.knowledgeData) : dataOrFn;
        
        const updatedProject = {
            ...store.activeProject,
            knowledgeData: newData,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    setChatMessages: (msgsOrFn) => {
        const store = get();
        if (!store.activeProject) return;

        const newMsgs = typeof msgsOrFn === 'function' ? msgsOrFn(store.activeProject.chatHistory) : msgsOrFn;

        const updatedProject = {
            ...store.activeProject,
            chatHistory: newMsgs,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    importProjectData: async (backup: ProjectBackup) => {
        const store = get();
        if (!store.activeProject) return;
        
        const updatedProject: ProjectData = {
            ...store.activeProject,
            harEntries: backup.harEntries || [],
            knowledgeData: backup.knowledgeData || { nodes: [], links: [] },
            chatHistory: backup.chatHistory || [],
            updatedAt: new Date().toISOString()
        };

        set({ activeProject: updatedProject });
        await storageService.saveProject(updatedProject); // Immediate save
    }
}));
