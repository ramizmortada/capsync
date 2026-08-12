'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Download, Edit3, Video, HardDrive, Images, Sparkles, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavBar() {
  const pathname = usePathname();
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  useEffect(() => {
    const updateStatus = () => {
      if (typeof window !== 'undefined') {
        setIsTranscribing(!!(window as any).__capsync_is_transcribing);
      }
    };

    updateStatus();
    window.addEventListener('capsync_transcription_status_change', updateStatus);
    return () => {
      window.removeEventListener('capsync_transcription_status_change', updateStatus);
    };
  }, []);

  const links = [
    { href: '/', label: 'Timelines', icon: Film },
    { href: '/download', label: 'Downloader', icon: Download },
    { href: '/editor', label: 'Editor', icon: Edit3 },
    { href: '/image-editor', label: 'Image Creator', icon: Sparkles },
    { href: '/image-to-video', label: 'Image to Video', icon: Images },
    { href: '/cache', label: 'Cache Storage', icon: HardDrive },
  ];

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    if (pathname === href) return;
    if (isTranscribing) {
      e.preventDefault();
      alert('Transcription is currently in progress. Please wait for transcription to complete before navigating to another tab.');
    }
  };

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col sticky top-0 h-screen shrink-0">
      <div className="p-6">
        <Link
          href="/"
          onClick={(e) => handleLinkClick(e, '/')}
          className="flex items-center gap-3 group"
        >
          <div className="bg-blue-600 p-2 rounded-xl group-hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
            <Video className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-2xl text-white tracking-tight">CapSync</span>
        </Link>
      </div>

      <div className="flex flex-col gap-2 px-4 mt-4 flex-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold transition-all',
                isActive
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : isTranscribing
                  ? 'text-zinc-500 cursor-not-allowed opacity-60 hover:bg-transparent'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-5 h-5',
                    isActive && link.href === '/' && 'text-blue-400',
                    isActive && link.href === '/download' && 'text-blue-400',
                    isActive && link.href === '/editor' && 'text-purple-400',
                    isActive && link.href === '/image-editor' && 'text-purple-400',
                    isActive && link.href === '/image-to-video' && 'text-emerald-400'
                  )}
                />
                <span>{link.label}</span>
              </div>
              {isTranscribing && !isActive && (
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-6 mt-auto">
        <div className="text-xs font-medium text-zinc-600 flex items-center gap-2">
          <span>CapSync Studio v1.0</span>
        </div>
      </div>
    </aside>
  );
}
