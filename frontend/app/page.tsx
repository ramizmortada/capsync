'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Folder, 
  FolderPlus, 
  Film, 
  Plus, 
  Trash2, 
  Copy, 
  Edit2, 
  Search, 
  Clock, 
  Calendar, 
  FileText,
  Video,
  MoveRight,
  ChevronRight,
  Grid,
  MoreVertical
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  getAllProjects, 
  createProject, 
  renameProject, 
  deleteProject, 
  getAllTimelines, 
  createTimeline, 
  duplicateTimeline, 
  renameTimeline, 
  deleteTimeline, 
  assignTimelineToProject, 
  Project, 
  TimelineMetadata 
} from '@/lib/timelineStorage';

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [timelines, setTimelines] = useState<TimelineMetadata[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | 'all' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Project Modals
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState('');

  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deleteContainedTimelines, setDeleteContainedTimelines] = useState(false);

  // Timeline Modals
  const [renamingTimelineId, setRenamingTimelineId] = useState<string | null>(null);
  const [renameTimelineValue, setRenameTimelineValue] = useState('');

  const [deletingTimelineId, setDeletingTimelineId] = useState<string | null>(null);

  const [moveTimelineTarget, setMoveTimelineTarget] = useState<TimelineMetadata | null>(null);
  const [destinationProjectId, setDestinationProjectId] = useState<string>('unassigned');

  const loadData = async () => {
    setIsLoading(true);
    const [projData, timeData] = await Promise.all([
      getAllProjects(),
      getAllTimelines(),
    ]);
    setProjects(projData);
    setTimelines(timeData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- PROJECT ACTIONS ---

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      const proj = await createProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreatingProject(false);
      await loadData();
      setSelectedProjectId(proj.id);
    }
  };

  const handleSaveRenameProject = async () => {
    if (renamingProjectId && renameProjectValue.trim()) {
      await renameProject(renamingProjectId, renameProjectValue.trim());
      setRenamingProjectId(null);
      await loadData();
    }
  };

  const handleDeleteProject = async () => {
    if (deletingProjectId) {
      await deleteProject(deletingProjectId, deleteContainedTimelines);
      setDeletingProjectId(null);
      if (selectedProjectId === deletingProjectId) {
        setSelectedProjectId('all');
      }
      await loadData();
    }
  };

  // --- TIMELINE ACTIONS ---

  const handleCreateTimeline = async () => {
    const projId = selectedProjectId === 'all' || selectedProjectId === 'unassigned' ? null : selectedProjectId;
    const newTimeline = await createTimeline(undefined, projId);
    router.push(`/editor?id=${newTimeline.id}`);
  };

  const handleOpenTimeline = (id: string) => {
    router.push(`/editor?id=${id}`);
  };

  const handleStartRenameTimeline = (t: TimelineMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingTimelineId(t.id);
    setRenameTimelineValue(t.name);
  };

  const handleSaveRenameTimeline = async () => {
    if (renamingTimelineId && renameTimelineValue.trim()) {
      await renameTimeline(renamingTimelineId, renameTimelineValue.trim());
      setRenamingTimelineId(null);
      await loadData();
    }
  };

  const handleDuplicateTimeline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await duplicateTimeline(id);
    await loadData();
  };

  const handleDeleteTimeline = async () => {
    if (deletingTimelineId) {
      await deleteTimeline(deletingTimelineId);
      setDeletingTimelineId(null);
      await loadData();
    }
  };

  const handleAssignProject = async () => {
    if (moveTimelineTarget) {
      const targetProj = destinationProjectId === 'unassigned' ? null : destinationProjectId;
      await assignTimelineToProject(moveTimelineTarget.id, targetProj);
      setMoveTimelineTarget(null);
      await loadData();
    }
  };

  // --- FILTERING ---

  const filteredTimelines = timelines.filter((t) => {
    // Project filter
    if (selectedProjectId === 'unassigned' && t.projectId) return false;
    if (selectedProjectId !== 'all' && selectedProjectId !== 'unassigned' && t.projectId !== selectedProjectId) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = t.name.toLowerCase().includes(query);
      const fileMatch = t.mediaFileName?.toLowerCase().includes(query);
      if (!nameMatch && !fileMatch) return false;
    }

    return true;
  }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const sortedProjects = [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const activeProject = sortedProjects.find((p) => p.id === selectedProjectId);

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-64px)] bg-neutral-950 text-neutral-50 p-8 flex flex-col">
      <div className="max-w-7xl w-full mx-auto flex flex-col gap-8">
        
        {/* Top Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">CapSync Studio</h1>
              <p className="text-sm text-neutral-400 font-medium">
                Organize projects and timelines for viral video creation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <Input
                placeholder="Search timelines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-neutral-900 border-neutral-800 text-sm focus-visible:ring-blue-500"
              />
            </div>

            <Button 
              onClick={() => setIsCreatingProject(true)} 
              variant="outline"
              className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold gap-2"
            >
              <FolderPlus className="w-4 h-4 text-blue-400" /> New Project
            </Button>

            <Button 
              onClick={handleCreateTimeline} 
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 shadow-lg shadow-blue-900/30 px-5"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> New Timeline
            </Button>
          </div>
        </div>

        {/* Main Content Area: Left Projects Sidebar + Right Timelines Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Projects Navigation Sidebar */}
          <div className="md:col-span-3 flex flex-col gap-2 bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-4">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-neutral-800/60 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-blue-400" /> Projects
              </span>
              <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-400 font-semibold">
                {projects.length}
              </span>
            </div>

            <button
              onClick={() => setSelectedProjectId('all')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedProjectId === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-neutral-300 hover:bg-neutral-800/80'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Grid className="w-4 h-4" /> All Timelines
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-md ${selectedProjectId === 'all' ? 'bg-blue-700 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                {timelines.length}
              </span>
            </button>

            <button
              onClick={() => setSelectedProjectId('unassigned')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedProjectId === 'unassigned'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-neutral-300 hover:bg-neutral-800/80'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Film className="w-4 h-4" /> Unassigned
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-md ${selectedProjectId === 'unassigned' ? 'bg-blue-700 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                {timelines.filter(t => !t.projectId).length}
              </span>
            </button>

            {sortedProjects.length > 0 && <div className="h-[1px] bg-neutral-800/80 my-1" />}

            {sortedProjects.map((proj) => {
              const count = timelines.filter(t => t.projectId === proj.id).length;
              const isSelected = selectedProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-neutral-300 hover:bg-neutral-800/80'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
                    <span className="truncate">{proj.name}</span>
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-md ${isSelected ? 'bg-blue-700 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Timelines Content Grid */}
          <div className="md:col-span-9 flex flex-col gap-6">
            
            {/* Selected Project Header Bar */}
            <div className="flex items-center justify-between bg-neutral-900/40 border border-neutral-800 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-950/60 border border-blue-800/40 rounded-xl flex items-center justify-center text-blue-400">
                  {activeProject ? <Folder className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {activeProject ? activeProject.name : selectedProjectId === 'unassigned' ? 'Unassigned Timelines' : 'All Timelines'}
                  </h2>
                  <p className="text-xs text-neutral-400 font-medium">
                    {filteredTimelines.length} {filteredTimelines.length === 1 ? 'timeline' : 'timelines'}
                  </p>
                </div>
              </div>

              {activeProject && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-neutral-400 hover:text-white hover:bg-neutral-800 gap-1.5 h-8 text-xs font-semibold"
                    onClick={() => {
                      setRenamingProjectId(activeProject.id);
                      setRenameProjectValue(activeProject.name);
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Rename Project
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-neutral-400 hover:text-red-400 hover:bg-neutral-800 gap-1.5 h-8 text-xs font-semibold"
                    onClick={() => setDeletingProjectId(activeProject.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Project
                  </Button>
                </div>
              )}
            </div>

            {/* Timelines Cards */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : filteredTimelines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-neutral-900/30 rounded-2xl border border-dashed border-neutral-800">
                <div className="h-16 w-16 bg-neutral-900 rounded-2xl flex items-center justify-center text-neutral-600 border border-neutral-800">
                  <Film className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-lg font-bold text-neutral-200">
                    {searchQuery ? 'No matching timelines' : 'No timelines in this project'}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {searchQuery 
                      ? 'Try searching for a different term.' 
                      : 'Create a new timeline to start editing video captions.'}
                  </p>
                </div>
                {!searchQuery && (
                  <Button onClick={handleCreateTimeline} className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 mt-2">
                    <Plus className="w-4 h-4" /> Create Timeline
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredTimelines.map((timeline) => {
                  const projName = projects.find(p => p.id === timeline.projectId)?.name;

                  return (
                    <div 
                      key={timeline.id}
                      onClick={() => handleOpenTimeline(timeline.id)}
                      className="group relative w-full bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900/90 transition-all duration-300 cursor-pointer rounded-2xl p-4 shadow-lg flex flex-row items-center justify-between gap-4 text-left"
                    >
                      {/* Left: Icon & Left-Aligned Title + Metadata */}
                      <div className="flex flex-row items-center gap-4 min-w-0 flex-1 justify-start text-left">
                        <div className="h-11 w-11 shrink-0 bg-blue-950/50 border border-blue-800/40 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                          <Film className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 text-left items-start">
                          <div className="flex items-center gap-2.5 flex-wrap text-left">
                            <h3 className="font-bold text-base text-neutral-100 group-hover:text-blue-400 transition-colors truncate text-left">
                              {timeline.name}
                            </h3>
                            {projName && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-neutral-800 text-blue-300 px-2 py-0.5 rounded-md border border-neutral-700/60 shrink-0">
                                <Folder className="w-3 h-3 text-blue-400" /> {projName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-neutral-400 font-medium flex-wrap mt-0.5 text-left">
                            {timeline.mediaFileName && (
                              <span className="text-neutral-400 truncate max-w-[220px]">
                                {timeline.mediaFileName}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-neutral-400">
                              <Clock className="w-3.5 h-3.5 text-neutral-500" />
                              {formatDuration(timeline.duration)}
                            </span>
                            <span className="flex items-center gap-1 text-neutral-400">
                              <FileText className="w-3.5 h-3.5 text-neutral-500" />
                              {timeline.segmentCount || 0} caps
                            </span>
                            <span className="flex items-center gap-1 text-neutral-500">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(timeline.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions Pinned Right */}
                      <div className="flex flex-row items-center gap-1 shrink-0 ml-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveTimelineTarget(timeline);
                            setDestinationProjectId(timeline.projectId || 'unassigned');
                          }}
                          title="Move to project"
                        >
                          <MoveRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
                          onClick={(e) => handleStartRenameTimeline(timeline, e)}
                          title="Rename timeline"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
                          onClick={(e) => handleDuplicateTimeline(timeline.id, e)}
                          title="Duplicate timeline"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-neutral-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingTimelineId(timeline.id);
                          }}
                          title="Delete timeline"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Create Project Dialog */}
      <Dialog open={isCreatingProject} onOpenChange={setIsCreatingProject}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. YouTube Shorts, Client A..."
              className="bg-neutral-950 border-neutral-800"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              autoFocus
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsCreatingProject(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} className="bg-blue-600 hover:bg-blue-500 font-semibold">Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Project Dialog */}
      <Dialog open={renamingProjectId !== null} onOpenChange={(open) => !open && setRenamingProjectId(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameProjectValue}
              onChange={(e) => setRenameProjectValue(e.target.value)}
              placeholder="Enter project name"
              className="bg-neutral-950 border-neutral-800"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameProject()}
              autoFocus
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setRenamingProjectId(null)}>Cancel</Button>
            <Button onClick={handleSaveRenameProject} className="bg-blue-600 hover:bg-blue-500 font-semibold">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={deletingProjectId !== null} onOpenChange={(open) => !open && setDeletingProjectId(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Project?</DialogTitle>
          </DialogHeader>
          <div className="py-3 flex flex-col gap-4 text-sm text-neutral-300">
            <p>Are you sure you want to delete this project?</p>
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-neutral-200">
              <input
                type="checkbox"
                checked={deleteContainedTimelines}
                onChange={(e) => setDeleteContainedTimelines(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-950 text-blue-600 focus:ring-blue-500"
              />
              Also delete all timelines contained in this project
            </label>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setDeletingProjectId(null)}>Cancel</Button>
            <Button onClick={handleDeleteProject} variant="destructive" className="bg-red-600 hover:bg-red-500 font-semibold">Delete Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Timeline Dialog */}
      <Dialog open={moveTimelineTarget !== null} onOpenChange={(open) => !open && setMoveTimelineTarget(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Timeline to Project</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-3">
            <p className="text-xs text-neutral-400">
              Select target project for <span className="font-bold text-white">{moveTimelineTarget?.name}</span>:
            </p>
            <Select value={destinationProjectId} onValueChange={setDestinationProjectId}>
              <SelectTrigger className="bg-neutral-950 border-neutral-800 text-sm">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                <SelectItem value="unassigned">Unassigned (No Project)</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>📁 {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setMoveTimelineTarget(null)}>Cancel</Button>
            <Button onClick={handleAssignProject} className="bg-blue-600 hover:bg-blue-500 font-semibold">Move Timeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Timeline Dialog */}
      <Dialog open={renamingTimelineId !== null} onOpenChange={(open) => !open && setRenamingTimelineId(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Timeline</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameTimelineValue}
              onChange={(e) => setRenameTimelineValue(e.target.value)}
              placeholder="Enter timeline name"
              className="bg-neutral-950 border-neutral-800"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameTimeline()}
              autoFocus
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setRenamingTimelineId(null)}>Cancel</Button>
            <Button onClick={handleSaveRenameTimeline} className="bg-blue-600 hover:bg-blue-500 font-semibold">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Timeline Dialog */}
      <Dialog open={deletingTimelineId !== null} onOpenChange={(open) => !open && setDeletingTimelineId(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Timeline?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-300 py-2">
            Are you sure you want to delete this timeline? This action cannot be undone.
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setDeletingTimelineId(null)}>Cancel</Button>
            <Button onClick={handleDeleteTimeline} variant="destructive" className="bg-red-600 hover:bg-red-500 font-semibold">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
