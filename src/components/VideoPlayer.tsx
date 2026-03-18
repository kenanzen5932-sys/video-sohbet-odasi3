import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, RotateCcw, RotateCw, Link, Loader2, Maximize2, Eye, EyeOff, PictureInPicture2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface VideoPlayerProps {
  videoUrl: string | null;
  isPlaying: boolean;
  playbackTime: number;
  isOwner: boolean;
  onUpdateUrl: (url: string) => void;
  onPlayPause: (isPlaying: boolean, currentTime: number) => void;
  onSeek: (time: number) => void;
  lastUpdated: string | null;
}

// YouTube URL'den video ID çıkar
const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /(?:youtube\.com\/shorts\/)([^?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
}

export const VideoPlayer = ({
  videoUrl,
  isPlaying,
  playbackTime,
  isOwner,
  onUpdateUrl,
  onPlayPause,
  onSeek,
  lastUpdated,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const youtubePlayerRef = useRef<YTPlayer | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPiP, setIsPiP] = useState(false);
  const wasPlayingBeforePiP = useRef(false);
  const justExitedPiP = useRef(false);
  const [ytApiReady, setYtApiReady] = useState(false);

  const isYouTube = videoUrl ? getYouTubeVideoId(videoUrl) !== null : false;
  const youtubeVideoId = videoUrl ? getYouTubeVideoId(videoUrl) : null;
  
  // iOS cihaz tespiti
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  // Mobil cihaz tespiti
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  // Orientation auto-fullscreen için ref
  const isFullscreenFromRotation = useRef(false);
  const orientationTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Ekran döndürme ile otomatik fullscreen
  useEffect(() => {
    if (!isMobile || !videoUrl) return;

    const handleOrientationChange = () => {
      clearTimeout(orientationTimeout.current);
      orientationTimeout.current = setTimeout(() => {
        const landscape = window.matchMedia('(orientation: landscape)').matches;
        
        if (landscape) {
          // Yatay çevrildi - Fullscreen yap
          isFullscreenFromRotation.current = true;
          
          if (isYouTube && youtubePlayerRef.current) {
            const iframe = youtubePlayerRef.current.getIframe?.();
            if (iframe) {
              if (iframe.requestFullscreen) {
                iframe.requestFullscreen().catch(() => {});
              } else if ((iframe as any).webkitRequestFullscreen) {
                (iframe as any).webkitRequestFullscreen();
              }
            }
          } else if (videoRef.current) {
            const video = videoRef.current as any;
            if (typeof video.webkitEnterFullscreen === 'function') {
              video.webkitEnterFullscreen();
            } else if (video.requestFullscreen) {
              video.requestFullscreen().catch(() => {});
            }
          }
        } else if (!landscape && isFullscreenFromRotation.current) {
          // Dikey çevrildi - Fullscreen'den çık
          isFullscreenFromRotation.current = false;
          
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitFullscreenElement) {
            (document as any).webkitExitFullscreen?.();
          }
          
          // iOS video için
          if (videoRef.current) {
            const video = videoRef.current as any;
            if (video.webkitDisplayingFullscreen) {
              video.webkitExitFullscreen?.();
            }
          }
        }
      }, 150);
    };

    // Event listeners
    window.addEventListener('orientationchange', handleOrientationChange);
    const mediaQuery = window.matchMedia('(orientation: landscape)');
    mediaQuery.addEventListener('change', handleOrientationChange);

    return () => {
      clearTimeout(orientationTimeout.current);
      window.removeEventListener('orientationchange', handleOrientationChange);
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, [videoUrl, isYouTube, isMobile]);

  // YouTube API yükle
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      window.onYouTubeIframeAPIReady = () => setYtApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
    };
  }, []);

  // Calculate smart sync time for new joiners only
  const calculateSyncTime = useCallback((forInitialSync = false) => {
    if (forInitialSync && isPlaying && lastUpdated) {
      const elapsed = (Date.now() - new Date(lastUpdated).getTime()) / 1000;
      const cappedElapsed = Math.min(elapsed, 10);
      return playbackTime + cappedElapsed;
    }
    return playbackTime;
  }, [isPlaying, lastUpdated, playbackTime]);

  // YouTube Player başlat
  useEffect(() => {
    if (!isYouTube || !youtubeVideoId || !ytApiReady || !youtubeContainerRef.current) return;

    setIsLoading(true);

    // Eski player'ı temizle
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.destroy();
      youtubePlayerRef.current = null;
    }

    // Container'ı temizle ve yeni div ekle
    if (youtubeContainerRef.current) {
      youtubeContainerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player-' + Date.now();
      youtubeContainerRef.current.appendChild(playerDiv);

      const player = new window.YT.Player(playerDiv, {
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: isIOS ? 1 : 0, // iOS'ta native controls göster (fullscreen için)
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            setIsLoading(false);
            const targetTime = calculateSyncTime(true);
            event.target.seekTo(targetTime, true);
            if (isPlaying) {
              event.target.playVideo();
            }
            setDuration(event.target.getDuration());
          },
          onStateChange: (event) => {
            // Owner için durum değişikliklerini yakala
            if (isOwner) {
              const playerState = event.data;
              if (playerState === window.YT.PlayerState.PLAYING) {
                setCurrentTime(event.target.getCurrentTime());
              } else if (playerState === window.YT.PlayerState.PAUSED) {
                setCurrentTime(event.target.getCurrentTime());
              }
            }
          },
          onError: (event) => {
            console.error('YouTube Error:', event.data);
            setIsLoading(false);
          },
        },
      });

      youtubePlayerRef.current = player;
    }

    return () => {
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
    };
  }, [youtubeVideoId, ytApiReady, isYouTube]);

  // YouTube için zaman takibi
  useEffect(() => {
    if (!isYouTube || !youtubePlayerRef.current || !isOwner) return;

    const interval = setInterval(() => {
      if (youtubePlayerRef.current) {
        try {
          const time = youtubePlayerRef.current.getCurrentTime();
          const dur = youtubePlayerRef.current.getDuration();
          setCurrentTime(time);
          if (dur > 0) setDuration(dur);
        } catch (e) {
          // Player henüz hazır değil
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isYouTube, isOwner]);

  // Initialize HLS (only for non-YouTube)
  useEffect(() => {
    if (!videoUrl || !videoRef.current || isYouTube) return;

    setIsLoading(true);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(videoUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (videoRef.current) {
          const targetTime = calculateSyncTime(true);
          videoRef.current.currentTime = targetTime;
          if (isPlaying) {
            videoRef.current.play().catch(console.error);
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS Error:', data);
        setIsLoading(false);
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = videoUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (videoRef.current) {
          const targetTime = calculateSyncTime(true);
          videoRef.current.currentTime = targetTime;
          if (isPlaying) {
            videoRef.current.play().catch(console.error);
          }
        }
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [videoUrl, isYouTube]);

  // Track current time and duration for progress bar (owner only, HLS)
  useEffect(() => {
    if (!videoRef.current || !isOwner || isYouTube) return;
    
    const video = videoRef.current;
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    const handleDurationChange = () => {
      setDuration(video.duration);
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', handleDurationChange);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', handleDurationChange);
    };
  }, [videoUrl, isOwner, isYouTube]);

  // Track last explicit owner action timestamp to detect real updates
  const lastOwnerActionRef = useRef<string | null>(null);

  // Sync playback state from owner ONLY when owner makes explicit action
  useEffect(() => {
    if (isOwner) return;
    
    // Only sync if lastUpdated changed (owner made an explicit action)
    if (lastUpdated === lastOwnerActionRef.current) {
      return;
    }
    
    lastOwnerActionRef.current = lastUpdated;
    
    if (isYouTube && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.seekTo(playbackTime, true);
        if (isPlaying) {
          youtubePlayerRef.current.playVideo();
        } else {
          youtubePlayerRef.current.pauseVideo();
        }
      } catch (e) {
        // Player henüz hazır değil
      }
    } else if (videoRef.current) {
      const video = videoRef.current;
      video.currentTime = playbackTime;
      
      if (isPlaying && video.paused) {
        video.play().catch(console.error);
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    }
  }, [lastUpdated, isPlaying, playbackTime, isOwner, isYouTube]);

  const handlePlayPause = () => {
    if (!isOwner) return;
    
    if (isYouTube && youtubePlayerRef.current) {
      try {
        const state = youtubePlayerRef.current.getPlayerState();
        const currentTimeYT = youtubePlayerRef.current.getCurrentTime();
        const newIsPlaying = state !== window.YT.PlayerState.PLAYING;
        
        if (newIsPlaying) {
          youtubePlayerRef.current.playVideo();
        } else {
          youtubePlayerRef.current.pauseVideo();
        }
        
        onPlayPause(newIsPlaying, currentTimeYT);
      } catch (e) {
        console.error('YouTube play/pause error:', e);
      }
    } else if (videoRef.current) {
      const video = videoRef.current;
      const newIsPlaying = video.paused;
      
      if (newIsPlaying) {
        video.play().catch(console.error);
      } else {
        video.pause();
      }
      
      onPlayPause(newIsPlaying, video.currentTime);
    }
  };

  const handleSeek = (seconds: number) => {
    if (!isOwner) return;
    
    if (isYouTube && youtubePlayerRef.current) {
      try {
        const currentTimeYT = youtubePlayerRef.current.getCurrentTime();
        const newTime = Math.max(0, currentTimeYT + seconds);
        youtubePlayerRef.current.seekTo(newTime, true);
        onSeek(newTime);
      } catch (e) {
        console.error('YouTube seek error:', e);
      }
    } else if (videoRef.current) {
      const video = videoRef.current;
      const newTime = Math.max(0, video.currentTime + seconds);
      video.currentTime = newTime;
      onSeek(newTime);
    }
  };

  const handleSliderSeek = (value: number[]) => {
    if (!isOwner) return;
    
    const newTime = value[0];
    
    if (isYouTube && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.seekTo(newTime, true);
        onSeek(newTime);
      } catch (e) {
        console.error('YouTube slider seek error:', e);
      }
    } else if (videoRef.current) {
      const video = videoRef.current;
      video.currentTime = newTime;
      onSeek(newTime);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '00:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      onUpdateUrl(urlInput.trim());
      setUrlInput('');
      setDialogOpen(false);
    }
  };

  const handleFullscreen = () => {
    if (isYouTube && youtubePlayerRef.current) {
      try {
        const iframe = youtubePlayerRef.current.getIframe();
        if (iframe) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            // Try standard fullscreen first, then webkit
            if (iframe.requestFullscreen) {
              iframe.requestFullscreen();
            } else if ((iframe as any).webkitRequestFullscreen) {
              (iframe as any).webkitRequestFullscreen();
            }
          }
        }
      } catch (e) {
        console.error('YouTube fullscreen error:', e);
      }
    } else if (videoRef.current) {
      const video = videoRef.current as HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
        webkitExitFullscreen?: () => void;
        webkitDisplayingFullscreen?: boolean;
      };

      // iOS Safari uses webkitEnterFullscreen on video element
      // Check function existence directly instead of webkitSupportsFullscreen property
      if (typeof video.webkitEnterFullscreen === 'function') {
        if (video.webkitDisplayingFullscreen) {
          video.webkitExitFullscreen?.();
        } else {
          video.webkitEnterFullscreen();
        }
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if ((video as any).webkitRequestFullscreen) {
        (video as any).webkitRequestFullscreen();
      }
    }
  };

  const handlePiP = async () => {
    if (isYouTube) {
      // YouTube PiP desteklemiyor embed modunda
      return;
    }
    
    if (!videoRef.current) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP Error:', error);
    }
  };

  // PiP event listeners - Mobile-optimized with retry mechanism (only for HLS)
  useEffect(() => {
    if (isYouTube) return;
    
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => {
      setIsPiP(true);
      wasPlayingBeforePiP.current = !video.paused;
    };

    const handleLeavePiP = () => {
      setIsPiP(false);
      justExitedPiP.current = true;

      const attemptPlay = (attempts = 5) => {
        if (wasPlayingBeforePiP.current && video.paused && attempts > 0) {
          video.play().catch(() => {
            setTimeout(() => attemptPlay(attempts - 1), 100);
          });
        }
      };

      setTimeout(() => attemptPlay(), 50);

      setTimeout(() => {
        justExitedPiP.current = false;
      }, 1000);
    };

    const handlePause = () => {
      if (justExitedPiP.current && wasPlayingBeforePiP.current) {
        video.play().catch(console.error);
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        justExitedPiP.current &&
        wasPlayingBeforePiP.current &&
        video.paused
      ) {
        video.play().catch(console.error);
      }
    };

    // iOS-specific fullscreen event handlers
    const handleiOSEnterFullscreen = () => {
      console.log('iOS fullscreen entered');
    };

    const handleiOSExitFullscreen = () => {
      console.log('iOS fullscreen exited');
    };

    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);
    video.addEventListener('pause', handlePause);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // iOS-specific fullscreen events
    video.addEventListener('webkitbeginfullscreen', handleiOSEnterFullscreen);
    video.addEventListener('webkitendfullscreen', handleiOSExitFullscreen);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      video.removeEventListener('webkitbeginfullscreen', handleiOSEnterFullscreen);
      video.removeEventListener('webkitendfullscreen', handleiOSExitFullscreen);
    };
  }, [videoUrl, isYouTube]);

  return (
    <div className="relative w-full h-full bg-cinema-dark rounded-lg overflow-hidden">
      {/* Video Container */}
      <div className="relative aspect-[4/3] lg:aspect-video lg:h-full bg-cinema-dark">
        {!videoUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {isOwner ? 'Video eklemek için aşağıdaki butonu kullanın' : 'Video bekleniyor...'}
            </p>
          </div>
        ) : isYouTube ? (
          <>
            <div 
              ref={youtubeContainerRef} 
              className="w-full h-full [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full"
            />
            {/* Fullscreen Button for YouTube - iOS'ta gizle çünkü YouTube native controls kullanıyor */}
            {!isIOS && (
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFullscreen}
                  className="text-foreground/70 hover:text-foreground hover:bg-secondary/50"
                  title="Tam Ekran"
                >
                  <Maximize2 className="w-5 h-5" />
                </Button>
              </div>
            )}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-cinema-dark/80">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            )}
          </>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
            />
            {/* PiP & Fullscreen Buttons - Always visible */}
            <div className="absolute top-2 right-2 flex gap-1">
              {document.pictureInPictureEnabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePiP}
                  className={`text-foreground/70 hover:text-foreground hover:bg-secondary/50 ${isPiP ? 'text-primary' : ''}`}
                  title="Mini Oynatıcı"
                >
                  <PictureInPicture2 className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFullscreen}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleFullscreen();
                }}
                className="text-foreground/70 hover:text-foreground hover:bg-secondary/50"
                title="Tam Ekran"
              >
                <Maximize2 className="w-5 h-5" />
              </Button>
            </div>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-cinema-dark/80">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls Toggle Button - Owner only */}
      {isOwner && videoUrl && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setControlsVisible(!controlsVisible)}
          className="absolute top-2 left-2 text-foreground/70 hover:text-foreground hover:bg-secondary/50 z-10"
        >
          {controlsVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </Button>
      )}

      {/* Controls */}
      {isOwner && controlsVisible && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-cinema-dark via-cinema-dark/90 to-transparent">
          {/* Progress Bar */}
          {videoUrl && duration > 0 && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-xs text-foreground/70 min-w-[40px]">{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration}
                step={1}
                onValueChange={handleSliderSeek}
                className="flex-1"
              />
              <span className="text-xs text-foreground/70 min-w-[40px] text-right">{formatTime(duration)}</span>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSeek(-10)}
              disabled={!videoUrl}
              className="text-foreground/80 hover:text-foreground hover:bg-secondary/50"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPause}
              disabled={!videoUrl}
              className="w-12 h-12 rounded-full bg-primary/20 text-primary hover:bg-primary/30 glow-primary"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSeek(10)}
              disabled={!videoUrl}
              className="text-foreground/80 hover:text-foreground hover:bg-secondary/50"
            >
              <RotateCw className="w-5 h-5" />
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-foreground/80 hover:text-foreground hover:bg-secondary/50"
                >
                  <Link className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-surface border-border/50">
                <DialogHeader>
                  <DialogTitle>Video URL Ekle</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-4">
                  <Input
                    placeholder="YouTube veya m3u8 link yapıştırın..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="bg-input border-border/50"
                  />
                  <Button onClick={handleAddUrl} className="w-full">
                    Videoyu Yükle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  );
};
