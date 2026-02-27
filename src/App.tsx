import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { Play, Search, Tv, X, MonitorPlay, AlertCircle, ChevronDown, Filter, Volume2, VolumeX, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Channel {
  name: string;
  logo: string;
  url: string;
  group: string;
}

function parseM3U(content: string): Channel[] {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      if (nameMatch) {
        currentChannel.name = nameMatch[1].trim();
      }
      
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      if (logoMatch) {
        currentChannel.logo = logoMatch[1];
      }

      const groupMatch = line.match(/group-title="([^"]+)"/);
      if (groupMatch) {
        currentChannel.group = groupMatch[1];
      }
    } else if (line && !line.startsWith('#')) {
      currentChannel.url = line;
      if (currentChannel.name && currentChannel.url) {
        channels.push({
          name: currentChannel.name,
          logo: currentChannel.logo || '',
          url: currentChannel.url,
          group: currentChannel.group || 'Uncategorized'
        });
      }
      currentChannel = {};
    }
  }
  return channels;
}

const ITEMS_PER_PAGE = 50;

export default function App() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [useProxy, setUseProxy] = useState(false);
  
  const playerRef = useRef<ReactPlayer>(null);
  const observerTarget = useRef<div | null>(null);

  // Load example playlist on mount for demo purposes if empty
  useEffect(() => {
    if (channels.length === 0 && !playlistUrl) {
       // Optional: Auto-load a demo playlist or just leave it empty
    }
  }, []);

  const loadPlaylist = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!playlistUrl) return;

    setLoading(true);
    setError('');
    setChannels([]);
    setCurrentChannel(null);
    setVisibleCount(ITEMS_PER_PAGE);
    
    try {
      // If proxy is manually checked, skip direct fetch
      let response;
      if (useProxy) {
          response = await fetch(`/api/proxy?url=${encodeURIComponent(playlistUrl)}`);
      } else {
          // Try fetching directly (Critical for IP-locked streams)
          try {
            response = await fetch(playlistUrl);
          } catch (directError) {
            console.error("Direct fetch failed:", directError);
            throw new Error(
                'Direct fetch failed. This is likely a CORS issue.\n\n' +
                'For IP-LOCKED streams:\n' +
                '1. Keep "PROXY" unchecked.\n' +
                '2. You MUST install a "Allow CORS" browser extension.\n' +
                '3. Ensure the link is HTTPS (Mixed Content cannot be played directly).'
            );
          }
      }

      if (!response.ok) throw new Error('Failed to fetch playlist');
      
      const content = await response.text();
      const parsedChannels = parseM3U(content);
      
      if (parsedChannels.length === 0) {
        throw new Error('No channels found in playlist');
      }
      
      setChannels(parsedChannels);
    } catch (err: any) {
      setError(err.message || 'Error loading playlist. It might be blocked by CORS.');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    if (currentChannel?.url === channel.url) return;
    setIsPlaying(false);
    setPlayerError('');
    setCurrentChannel(channel);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlayerReady = () => {
    setIsPlaying(true);
  };

  const handlePlayerError = (e: any) => {
    console.error("Player error:", e);
    if (e && (e.name === 'NotAllowedError' || e.message?.includes('play() request was interrupted'))) {
        // This specific error is often benign or handled by the state reset, but if it persists as an autoplay block:
        if (!isMuted && !isPlaying) {
            setIsMuted(true);
            setPlayerError('Autoplay blocked. Muting audio to play.');
            setTimeout(() => setIsPlaying(true), 100);
        }
    } else {
        setPlayerError('Stream error. Try toggling "Proxy Mode" if the channel is blocked.');
    }
  };

  const groups = useMemo(() => {
    const allGroups = new Set(channels.map(c => c.group));
    return ['All', ...Array.from(allGroups).sort()];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const filtered = channels.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = selectedGroup === 'All' || c.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
    return filtered;
  }, [channels, searchQuery, selectedGroup]);

  const visibleChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount);
  }, [filteredChannels, visibleCount]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredChannels.length) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredChannels.length));
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, filteredChannels.length]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery, selectedGroup]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-center gap-2 text-emerald-500 shrink-0">
              <MonitorPlay size={28} />
              <h1 className="text-xl font-bold tracking-tight text-white">IPTV Player</h1>
            </div>

            <form onSubmit={loadPlaylist} className="flex-1 max-w-2xl w-full flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="url"
                  placeholder="Paste M3U Playlist URL"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  className="w-full bg-zinc-800/50 text-sm rounded-full px-4 py-2 border border-zinc-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-500 pr-24"
                />
                <label className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 cursor-pointer group" title="Force Proxy (Fix CORS/HTTP)">
                  <input 
                    type="checkbox" 
                    checked={useProxy} 
                    onChange={(e) => setUseProxy(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500 bg-zinc-700"
                  />
                  <span className="text-[10px] font-bold text-zinc-400 group-hover:text-emerald-400 transition-colors">PROXY</span>
                </label>
              </div>
              <button 
                type="submit"
                disabled={loading || !playlistUrl}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-sm font-medium px-6 py-2 rounded-full transition-colors shadow-lg shadow-emerald-900/20"
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div className="whitespace-pre-wrap text-sm">{error}</div>
          </div>
        )}

        {/* Player Section - Sticky when active */}
        <AnimatePresence>
          {currentChannel && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="sticky top-[73px] z-40 -mx-4 md:mx-0 shadow-2xl shadow-black/50"
            >
              <div className="bg-black aspect-video w-full max-h-[70vh] relative group rounded-none md:rounded-2xl overflow-hidden border border-zinc-800">
                <ReactPlayer
                  ref={playerRef}
                  url={currentChannel.url}
                  playing={isPlaying}
                  muted={isMuted}
                  controls
                  width="100%"
                  height="100%"
                  style={{ backgroundColor: 'black' }}
                  config={{
                    file: {
                      forceHLS: true,
                      attributes: { crossOrigin: 'anonymous' },
                      hlsOptions: {
                        enableWorker: true,
                        lowLatencyMode: true,
                        backBufferLength: 90,
                        xhrSetup: function(xhr: XMLHttpRequest, url: string) {
                          // Proxy all HLS requests through our backend to bypass CORS/Mixed Content
                          // Only proxy if it's an external URL (http/https) AND proxy mode is enabled
                          if (useProxy && url.startsWith('http')) {
                            xhr.open('GET', `/api/proxy?url=${encodeURIComponent(url)}`, true);
                          }
                        }
                      }
                    }
                  }}
                  onReady={handlePlayerReady}
                  onError={handlePlayerError}
                  onPlay={() => setPlayerError('')}
                />
                
                {/* Custom Controls Overlay */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                   <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <button 
                    onClick={() => setUseProxy(!useProxy)}
                    className={`p-2 rounded-full backdrop-blur-sm transition-colors ${useProxy ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-black/50 text-white hover:bg-black/80'}`}
                    title={useProxy ? "Disable Proxy" : "Enable Proxy (Fix CORS)"}
                  >
                    <div className="flex items-center gap-1">
                        <RefreshCw size={20} className={useProxy ? "animate-spin-slow" : ""} />
                        <span className="text-[10px] font-bold">{useProxy ? 'PROXY ON' : 'PROXY OFF'}</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => {
                        setPlayerError('');
                        setIsPlaying(false);
                        setTimeout(() => setIsPlaying(true), 100);
                    }}
                    className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
                    title="Reload Stream"
                  >
                    <RefreshCw size={20} />
                  </button>
                  <button 
                    onClick={() => setCurrentChannel(null)}
                    className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
                    title="Close Player"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Player Error Overlay */}
                {playerError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 p-4 text-center">
                        <AlertCircle size={48} className="text-red-500 mb-4" />
                        <p className="text-white font-medium mb-2">Playback Error</p>
                        <p className="text-zinc-400 text-sm mb-4 max-w-md">{playerError}</p>
                        <button 
                            onClick={() => {
                                setPlayerError('');
                                setIsPlaying(true);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}
                
                {/* Info Overlay */}
                {!playerError && (
                    <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <h2 className="text-2xl font-bold text-white drop-shadow-md">{currentChannel.name}</h2>
                    <p className="text-zinc-300 drop-shadow">{currentChannel.group}</p>
                    </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls & Filters */}
        {channels.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-800 text-sm rounded-xl pl-10 pr-4 py-2.5 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                <Filter size={16} className="text-zinc-500 shrink-0" />
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="bg-zinc-800 text-sm rounded-xl px-4 py-2.5 border border-zinc-700 focus:outline-none focus:border-emerald-500 appearance-none min-w-[150px] cursor-pointer"
                >
                  {groups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="text-xs text-zinc-500 whitespace-nowrap px-2">
                  {filteredChannels.length} channels
                </div>
              </div>
            </div>

            {/* Channel Grid */}
            {filteredChannels.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {visibleChannels.map((channel, idx) => (
                  <button
                    key={`${channel.url}-${idx}`}
                    onClick={() => handleChannelSelect(channel)}
                    className={`group relative aspect-square flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 hover:scale-105 hover:shadow-xl ${
                      currentChannel?.url === channel.url 
                        ? 'bg-emerald-900/20 border-emerald-500/50 ring-2 ring-emerald-500/20' 
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-center w-full mb-3">
                      {channel.logo ? (
                        <img 
                          src={channel.logo} 
                          alt={channel.name} 
                          className="max-w-full max-h-20 object-contain drop-shadow-lg transition-transform group-hover:scale-110" 
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }} 
                        />
                      ) : null}
                      <div className={`hidden w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center ${!channel.logo ? '!flex' : ''}`}>
                        <Tv size={32} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="w-full text-center">
                      <p className="text-sm font-medium text-zinc-200 truncate w-full group-hover:text-white transition-colors">
                        {channel.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider truncate mt-1">
                        {channel.group}
                      </p>
                    </div>

                    {currentChannel?.url === channel.url && (
                      <div className="absolute top-3 right-3 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                    )}
                  </button>
                ))}
                
                {/* Infinite Scroll Trigger */}
                <div ref={observerTarget} className="col-span-full h-10 flex items-center justify-center">
                  {visibleCount < filteredChannels.length && (
                    <Loader2 className="animate-spin text-zinc-600" size={24} />
                  )}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-zinc-500 bg-zinc-900/30 rounded-3xl border border-zinc-800/50 border-dashed">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg">No channels found</p>
                <p className="text-sm opacity-60">Try adjusting your search or filter</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {channels.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 shadow-2xl rotate-3">
              <Tv size={48} className="text-emerald-500" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-2xl font-bold text-white">Welcome to IPTV Player</h2>
              <p className="text-zinc-400">
                Enter a valid M3U playlist URL above to load your channels. 
                We support HLS streams and automatic channel grouping.
              </p>
            </div>
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 text-xs text-zinc-500 font-mono">
              https://iptv-org.github.io/iptv/index.m3u
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
