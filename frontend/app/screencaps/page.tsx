'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Folder, 
  Film, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  Clock, 
  Images,
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
  getAllScreencaps, 
  createScreencapProject, 
  deleteScreencapProject, 
  ScreencapMetadata 
} from '@/lib/screencapStorage';

export default function ScreencapsDashboard() {
  const router = useRouter();
  const [screencaps, setScreencaps] = useState<ScreencapMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    
    // Check for legacy data to migrate
    const savedStaged = localStorage.getItem('capsync_staged_captions');
    const savedCanvasesStr = localStorage.getItem('capsync_editor_canvases');
    
    if (savedStaged || savedCanvasesStr) {
      try {
        const { get } = await import('idb-keyval');
        const standaloneBlob = await get<Blob>('capsync_image_creator_video_blob') || null;
        
        let itemsToStage = [];
        let legacyCanvases = [];
        let legacyStyle = undefined;
        
        try { if (savedStaged) itemsToStage = JSON.parse(savedStaged); } catch (e) {}
        try { if (savedCanvasesStr) legacyCanvases = JSON.parse(savedCanvasesStr); } catch (e) {}
        
        const savedStyleStr = localStorage.getItem('capsync_subtitle_style');
        try { if (savedStyleStr) legacyStyle = JSON.parse(savedStyleStr); } catch (e) {}

        if (itemsToStage.length > 0 || legacyCanvases.length > 0) {
          await createScreencapProject(
            `Migrated Screencap`, 
            standaloneBlob as File | null, 
            itemsToStage, 
            legacyCanvases,
            legacyStyle
          );

          localStorage.removeItem('capsync_staged_captions');
          localStorage.removeItem('capsync_editor_canvases');
          localStorage.removeItem('capsync_subtitle_style');
        }
      } catch (err) {
        console.error('Migration failed in dashboard', err);
      }
    }

    const data = await getAllScreencaps();
    setScreencaps(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProject = async () => {
    const newProj = await createScreencapProject(`Screencap ${new Date().toLocaleDateString()}`);
    router.push(`/image-editor?id=${newProj.id}`);
  };

  const handleOpenProject = (id: string) => {
    router.push(`/image-editor?id=${id}`);
  };

  const handleDeleteProject = async () => {
    if (deletingId) {
      await deleteScreencapProject(deletingId);
      setDeletingId(null);
      await loadData();
    }
  };

  const filteredScreencaps = screencaps.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-neutral-950">
      <div className="max-w-7xl mx-auto p-8 h-full flex flex-col">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">Screencaps</h1>
            <p className="text-neutral-400 font-medium text-lg">Manage your cinematic image sets and carousels.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <Input
                placeholder="Search screencaps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-neutral-900/50 border-neutral-800 h-11 text-base rounded-xl"
              />
            </div>
            <Button 
              onClick={handleCreateProject}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-emerald-900/20 gap-2"
            >
              <Plus className="w-5 h-5" /> New Screencap
            </Button>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredScreencaps.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-neutral-900/20 border border-neutral-800/50 rounded-3xl border-dashed">
            <div className="bg-neutral-900 p-6 rounded-full mb-6 border border-neutral-800">
              <Images className="w-12 h-12 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No Screencaps Found</h3>
            <p className="text-neutral-400 mb-8 max-w-md text-lg">
              {searchQuery 
                ? "We couldn't find any screencaps matching your search."
                : "You haven't created any screencaps yet. Start by sending captions from a timeline or creating a new one!"}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreateProject} size="lg" className="bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-2 h-12 px-8 text-base">
                <Plus className="w-5 h-5" /> Create Your First Screencap
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredScreencaps.map((screencap) => (
              <Card 
                key={screencap.id}
                className="bg-neutral-900/40 border-neutral-800/60 overflow-hidden hover:border-emerald-500/50 hover:bg-neutral-900/80 transition-all group cursor-pointer"
                onClick={() => handleOpenProject(screencap.id)}
              >
                <div className="aspect-video bg-neutral-950 flex items-center justify-center border-b border-neutral-800/60 relative">
                  <Images className="w-10 h-10 text-neutral-800 group-hover:text-emerald-500/30 transition-colors" />
                </div>
                
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-bold text-lg text-neutral-100 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-tight">
                      {screencap.name}
                    </h3>
                    
                    <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-500 hover:text-red-400 hover:bg-red-950/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(screencap.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                      <Clock className="w-3.5 h-3.5" />
                      Last edited {new Date(screencap.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                        <Images className="w-3.5 h-3.5" /> {screencap.stagedItemCount || 0} Frames
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Modal */}
        <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
          <DialogContent className="bg-neutral-900 border-neutral-800 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-400">Delete Screencap</DialogTitle>
            </DialogHeader>
            <p className="text-neutral-300 py-4 font-medium text-base">
              Are you sure you want to delete this screencap project? This action cannot be undone.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setDeletingId(null)} className="font-semibold">Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteProject} className="font-bold px-6">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
