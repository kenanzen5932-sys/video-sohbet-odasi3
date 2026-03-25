import { useRef, useEffect, type RefObject } from 'react';
import { Maximize2, MonitorOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScreenShareViewProps {
  track: any; // RemoteTrack from livekit
  participantName: string;
  isLocalShare?: boolean;
  onStopShare?: () => void;
  fullscreenTargetRef?: RefObject<HTMLDivElement>;
}

export const ScreenShareView = ({ track, participantName, isLocalShare, onStopShare, fullscreenTargetRef }: ScreenShareViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tryLockLandscape = async () => {
    const orientation = (screen as any)?.orientation;
    if (orientation?.lock) {
      try {
        await orientation.lock('landscape');
      } catch {
        // Some browsers require user gesture/permissions; safe to ignore.
      }
    }
  };

  const tryUnlockOrientation = () => {
    const orientation = (screen as any)?.orientation;
    if (orientation?.unlock) {
      try {
        orientation.unlock();
      } catch {
        // Ignore unsupported states.
      }
    }
  };

  useEffect(() => {
    if (!track || !videoRef.current) return;

    track.attach(videoRef.current);

    return () => {
      track.detach(videoRef.current!);
    };
  }, [track]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        tryUnlockOrientation();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleFullscreen = async () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current as any;
    const fullscreenTarget = fullscreenTargetRef?.current || containerRef.current;
    
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      tryUnlockOrientation();
    } else if (fullscreenTarget?.requestFullscreen) {
      await fullscreenTarget.requestFullscreen();
      await tryLockLandscape();
    } else if ((fullscreenTarget as any)?.webkitRequestFullscreen) {
      (fullscreenTarget as any).webkitRequestFullscreen();
      await tryLockLandscape();
    } else if (typeof video.webkitEnterFullscreen === 'function') {
      // iOS Safari fallback (native video fullscreen)
      video.webkitEnterFullscreen();
    } else if (video.webkitRequestFullscreen) {
      video.webkitRequestFullscreen();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-cinema-dark rounded-lg overflow-hidden">
      <div className="relative w-full h-full bg-cinema-dark">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
        />
        
        {/* Info bar */}
        <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded-md bg-destructive/80 text-destructive-foreground text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-destructive-foreground animate-pulse" />
          {isLocalShare ? 'Ekranınızı paylaşıyorsunuz' : `${participantName} ekran paylaşıyor`}
        </div>

        {/* Controls */}
        <div className="absolute top-2 right-2 flex gap-1">
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
          
          {isLocalShare && onStopShare && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onStopShare}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Paylaşımı Durdur"
            >
              <MonitorOff className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
