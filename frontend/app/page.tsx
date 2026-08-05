'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Film, 
  Plus, 
  Trash2, 
  Copy, 
  Edit2, 
  Play, 
  Search, 
  Clock, 
  Calendar, 
  FileText,
  Video,
  MoreVertical,
  Check,
  X
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
  getAllTimelines, 
  createTimeline, 
  duplicateTimeline, 
  renameTimeline, 
  deleteTimeline, 
  TimelineMetadata 
} from '@/lib/timelineStorage';

export default function Home() {
  const router = useRouter();
  const [timelines, setTimelines] = useState<TimelineMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Rename modal state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTimelines = async () => {
    setIsLoading(true);
    const data = await getAllTimelines();
    setTimelines(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadTimelines();
  }, []);

  const handleCreateNew = async () => {
    const newTimeline = await createTimeline();
    router.push(`/editor?id=${newTimeline.id}`);
  };

  const handleOpenTimeline = (id: string) => {
    router.push(`/editor?id=${id}`);
  };

  const handleStartRename = (timeline: TimelineMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(timeline.id);
    setRenameValue(timeline.name);
  };

  const handleSaveRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameTimeline(renamingId, renameValue.trim());
      setRenamingId(null);
      await loadTimelines();
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await duplicateTimeline(id);
    await loadTimelines();
  };

  const handleDelete = async () => {
    if (deletingId) {
      await deleteTimeline(deletingId);
      setDeletingId(null);
      await loadTimelines();
    }
  };

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

  const filteredTimelines = timelines.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.mediaFileName && t.mediaFileName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 min-h-[calc(100vh-64px)] bg-neutral-950 text-neutral-50 p-8 flex flex-col">
      <div className="max-w-7xl w-full mx-auto flex flex-col gap-8">
        
        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">Timelines Dashboard</h1>
              <p className="text-sm text-neutral-400 font-medium">
                Manage, edit, and create viral video timelines
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
              onClick={handleCreateNew} 
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 shadow-lg shadow-blue-900/30 px-5"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> New Timeline
            </Button>
          </div>
        </div>

        {/* Timelines Grid */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filteredTimelines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-4 bg-neutral-900/30 rounded-2xl border border-dashed border-neutral-800">
            <div className="h-16 w-16 bg-neutral-900 rounded-2xl flex items-center justify-center text-neutral-600 border border-neutral-800">
              <Film className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-bold text-neutral-200">
                {searchQuery ? 'No timelines found' : 'No timelines yet'}
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                {searchQuery 
                  ? 'Try searching for a different keyword or clear the search filter.' 
                  : 'Get started by creating your first timeline to transcribe, edit captions, and style videos.'}
              </p>
            </div>
            {!searchQuery && (
              <Button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 mt-2">
                <Plus className="w-4 h-4" /> Create Timeline
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTimelines.map((timeline) => (
              <Card 
                key={timeline.id}
                onClick={() => handleOpenTimeline(timeline.id)}
                className="group relative bg-neutral-900 border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900/90 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between p-5 shadow-xl"
              >
                {/* Top Row: Title & Action Menu */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-10 w-10 shrink-0 bg-blue-950/50 border border-blue-800/40 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                      <Film className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-base text-neutral-100 group-hover:text-blue-400 transition-colors truncate">
                        {timeline.name}
                      </h3>
                      {timeline.mediaFileName && (
                        <p className="text-xs text-neutral-400 truncate">
                          {timeline.mediaFileName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Dropdown / Quick Buttons */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
                      onClick={(e) => handleStartRename(timeline, e)}
                      title="Rename timeline"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
                      onClick={(e) => handleDuplicate(timeline.id, e)}
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
                        setDeletingId(timeline.id);
                      }}
                      title="Delete timeline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Bottom Row: Metadata & Open Indicator */}
                <div className="pt-4 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400 font-medium">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      {formatDuration(timeline.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-neutral-500" />
                      {timeline.segmentCount || 0} caps
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-neutral-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(timeline.updatedAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

      </div>

      {/* Rename Dialog */}
      <Dialog open={renamingId !== null} onOpenChange={(open) => !open && setRenamingId(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Timeline</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter timeline name"
              className="bg-neutral-950 border-neutral-800"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              autoFocus
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setRenamingId(null)}>Cancel</Button>
            <Button onClick={handleSaveRename} className="bg-blue-600 hover:bg-blue-500 font-semibold">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Timeline?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-300 py-2">
            Are you sure you want to delete this timeline? This action cannot be undone.
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button onClick={handleDelete} variant="destructive" className="bg-red-600 hover:bg-red-500 font-semibold">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
