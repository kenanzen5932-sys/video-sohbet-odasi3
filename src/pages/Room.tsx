import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ChatBox } from '@/components/ChatBox';
import { VoiceControls } from '@/components/VoiceControls';
import { ParticipantsDialog } from '@/components/ParticipantsDialog';
import { SpeakingAvatars } from '@/components/SpeakingAvatars';
import { ScreenShareView } from '@/components/ScreenShareView';
import { DanmakuOverlay } from '@/components/DanmakuOverlay';
import { useRoom } from '@/hooks/useRoom';
import { useChat } from '@/hooks/useChat';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const Room = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const screenShareContainerRef = useRef<HTMLDivElement>(null);
  
  const { user, profile } = useAuth();

  const {
    room,
    videoState,
    loading: roomLoading,
    error: roomError,
    isOwner,
    updateVideoUrl,
    updatePlaybackState,
    seekTo,
  } = useRoom(code || '', user?.id);

  const {
    messages,
    loading: chatLoading,
    sendMessage,
    sendSystemMessage,
    clearMessages,
    userId,
  } = useChat(room?.id, profile, user?.id);

  // Room presence for tracking all users in the room
  const { participants: presenceParticipants, trackSpeakingStatus } = useRoomPresence({
    roomCode: code || '',
    userId: user?.id,
    username: profile?.username,
    avatarUrl: profile?.avatar_url,
  });

  const handleParticipantJoin = useCallback((name: string) => {
    sendSystemMessage(`${name} katıldı`);
  }, [sendSystemMessage]);

  const {
    isConnected: voiceConnected,
    isConnecting: voiceConnecting,
    isMicEnabled,
    isScreenSharing,
    remoteScreenShare,
    participants: voiceParticipants,
    error: voiceError,
    connect: connectVoice,
    disconnect: disconnectVoice,
    toggleMic,
    startScreenShare,
    stopScreenShare,
  } = useVoiceChat(code, room?.id, handleParticipantJoin, profile?.username);

  // Broadcast mic status to presence when it changes
  useEffect(() => {
    if (voiceConnected) {
      trackSpeakingStatus(isMicEnabled);
    }
  }, [isMicEnabled, voiceConnected, trackSpeakingStatus]);

  // Determine if screen share is active (local or remote)
  const hasActiveScreenShare = isScreenSharing || !!remoteScreenShare;

  if (roomLoading) {
    return (
      <div className="min-h-screen cinema-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div className="min-h-screen cinema-gradient flex flex-col items-center justify-center p-6">
        <p className="text-destructive mb-4">{roomError || 'Oda bulunamadı'}</p>
        <Button onClick={() => navigate('/')} variant="secondary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Ana Sayfaya Dön
        </Button>
      </div>
    );
  }

  const currentUser = {
    id: user?.id || '',
    username: profile?.username || 'Anonim',
    avatar_url: profile?.avatar_url || null,
  };

  return (
    <div className="h-[100dvh] cinema-gradient flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-3 py-2 mt-6 border-b border-border/30">
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Speaking avatars in center */}
        <SpeakingAvatars
          participants={presenceParticipants}
          currentUserMicEnabled={isMicEnabled && voiceConnected}
          currentUserAvatar={profile?.avatar_url || null}
          currentUserUsername={profile?.username || 'Anonim'}
          onClick={() => setParticipantsOpen(true)}
        />

        <div className="flex items-center gap-2">
          <VoiceControls
            isConnected={voiceConnected}
            isConnecting={voiceConnecting}
            isMicEnabled={isMicEnabled}
            isScreenSharing={isScreenSharing}
            participantCount={presenceParticipants.size + 1}
            error={voiceError}
            onToggleMic={toggleMic}
            onConnect={connectVoice}
            onDisconnect={disconnectVoice}
            onOpenParticipants={() => setParticipantsOpen(true)}
            onStartScreenShare={startScreenShare}
            onStopScreenShare={stopScreenShare}
          />
        </div>
      </header>

      {/* Participants Dialog */}
      <ParticipantsDialog
        participants={presenceParticipants}
        isOwner={isOwner}
        currentUser={currentUser}
        isMicEnabled={isMicEnabled}
        isConnected={voiceConnected}
        roomCode={code || ''}
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden lg:px-8 lg:gap-6 lg:py-4">
        {/* Video / Screen Share Section */}
        <div className="shrink-0 px-2 pt-2 lg:px-0 lg:pt-0 lg:flex-[2] lg:h-full lg:min-w-0">
          {hasActiveScreenShare ? (
            // Show screen share - hide video
            <div ref={screenShareContainerRef} className="relative w-full h-full">
              {remoteScreenShare ? (
                <ScreenShareView
                  track={remoteScreenShare.track}
                  participantName={remoteScreenShare.participantName}
                  fullscreenTargetRef={screenShareContainerRef}
                />
              ) : (
                <LocalScreenShareView
                  roomRef={null}
                  onStopShare={stopScreenShare}
                  username={profile?.username || 'Sen'}
                />
              )}
              {/* Danmaku overlay on screen share */}
              <div className="absolute inset-0 pointer-events-none z-[9999] overflow-hidden">
                <DanmakuOverlay messages={messages} />
              </div>
            </div>
          ) : (
            <VideoPlayer
              videoUrl={videoState?.video_url || null}
              isPlaying={videoState?.is_playing || false}
              playbackTime={videoState?.playback_time || 0}
              isOwner={isOwner}
              onUpdateUrl={updateVideoUrl}
              onPlayPause={updatePlaybackState}
              onSeek={seekTo}
              lastUpdated={videoState?.updated_at || null}
              danmakuOverlay={<DanmakuOverlay messages={messages} />}
            />
          )}
        </div>

        {/* Chat Section */}
        <div className="flex-1 min-h-0 px-2 pb-2 pt-2 flex flex-col lg:px-0 lg:pt-0 lg:pb-0 lg:w-[400px] lg:flex-none lg:h-full">
          <ChatBox
            messages={messages}
            currentUserId={userId || ''}
            onSendMessage={sendMessage}
            onClearMessages={clearMessages}
            isOwner={isOwner}
            loading={chatLoading}
          />
        </div>
      </main>
    </div>
  );
};

// Simple component for showing local screen share feedback
const LocalScreenShareView = ({ onStopShare, username }: { roomRef: any; onStopShare: () => void; username: string }) => {
  return (
    <div className="relative w-full h-full bg-cinema-dark rounded-lg overflow-hidden">
      <div className="relative aspect-[4/3] lg:aspect-video lg:h-full bg-cinema-dark flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/80 text-destructive-foreground text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-destructive-foreground animate-pulse" />
          Ekranınızı paylaşıyorsunuz
        </div>
        <p className="text-muted-foreground text-sm">Diğer kullanıcılar ekranınızı görüyor</p>
        <Button
          variant="destructive"
          size="sm"
          onClick={onStopShare}
        >
          Paylaşımı Durdur
        </Button>
      </div>
    </div>
  );
};

export default Room;
