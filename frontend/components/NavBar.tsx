'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Download, Edit3, Video, HardDrive, Images } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavBar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Timelines', icon: Film },
    { href: '/download', label: 'Downloader', icon: Download },
    { href: '/editor', label: 'Editor', icon: Edit3 },
    { href: '/image-to-video', label: 'Image to Video', icon: Images },
    { href: '/cache', label: 'Cache Storage', icon: HardDrive },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col sticky top-0 h-screen shrink-0">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 group">
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
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all",
                isActive 
                  ? "bg-zinc-800 text-white shadow-sm" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && link.href === '/' && "text-blue-400", isActive && link.href === '/download' && "text-blue-400", isActive && link.href === '/editor' && "text-purple-400", isActive && link.href === '/image-to-video' && "text-emerald-400")} />
              {link.label}
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
