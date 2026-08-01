import Link from 'next/link';
import { Download, Edit3, Sparkles, Video } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[calc(100vh-64px)] bg-neutral-950 text-neutral-50">
      
      <div className="flex flex-col items-center text-center gap-4 mb-16 max-w-2xl">
        <div className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-900/50 mb-4">
          <Video className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter">CapSync <span className="text-blue-500">Studio</span></h1>
        <p className="text-lg text-zinc-400 font-medium">
          The ultimate viral video creation suite. Download, transcribe, style, and use AI to find the perfect clips all in one seamless workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        
        <Link href="/download" className="group">
          <Card className="h-full bg-zinc-900 border-zinc-800 p-8 flex flex-col gap-6 hover:border-blue-500 hover:bg-zinc-800/80 transition-all duration-300">
            <div className="h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
              <Download className="w-6 h-6 text-zinc-300 group-hover:text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-zinc-100 group-hover:text-blue-400 transition-colors">1. Download</h2>
              <p className="text-zinc-400 leading-relaxed">
                Fetch high-quality video and audio directly from YouTube using our lightning-fast server-side downloader.
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/editor" className="group">
          <Card className="h-full bg-zinc-900 border-zinc-800 p-8 flex flex-col gap-6 hover:border-purple-500 hover:bg-zinc-800/80 transition-all duration-300">
            <div className="h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-purple-600 transition-colors">
              <Edit3 className="w-6 h-6 text-zinc-300 group-hover:text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-zinc-100 group-hover:text-purple-400 transition-colors">2. Caption & Edit</h2>
              <p className="text-zinc-400 leading-relaxed">
                Transcribe with WhisperX and style your subtitles using a powerful timeline editor with instant live previews.
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/clips" className="group">
          <Card className="h-full bg-zinc-900 border-zinc-800 p-8 flex flex-col gap-6 hover:border-amber-500 hover:bg-zinc-800/80 transition-all duration-300">
            <div className="h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
              <Sparkles className="w-6 h-6 text-zinc-300 group-hover:text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-zinc-100 group-hover:text-amber-400 transition-colors">3. AI Highlights</h2>
              <p className="text-zinc-400 leading-relaxed">
                Let Gemini analyze your transcript and automatically extract the most viral segments for TikTok, Reels, and Shorts.
              </p>
            </div>
          </Card>
        </Link>

      </div>
    </div>
  );
}
