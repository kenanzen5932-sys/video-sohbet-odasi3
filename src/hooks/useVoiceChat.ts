import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  Participant,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  RemoteTrackPublication,
  RemoteTrack,
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

interface ScreenShareInfo {
  participantIdentity: string;
  participantName: string;
  track: RemoteTrack | null;
}

interface VoiceChatState {
  isConnected: boolean;
  isConnecting: boolean;
  isMicEnabled: boolean;
  isScreenSharing: boolean;
  remoteScreenShare: ScreenShareInfo | null;
  participants: Map<string, { name: string; isSpeaking: boolean }>;
  error: string | null;
}

type OnParticipantJoinCallback = (name: string) => void;

export const useVoiceChat = (
  roomCode: string | undefined,
  roomId: string | undefined,
  onParticipantJoin?: OnParticipantJoinCallback,
  username?: string
) => {
  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isConnecting: false,
    isMicEnabled: false,
    isScreenSharing: false,
    remoteScreenShare: null,
    participants: new Map(),
    error: null,
  });

  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const onParticipantJoinRef = useRef<OnParticipantJoinCallback | undefined>(onParticipantJoin);

  useEffect(() => {
    onParticipantJoinRef.current = onParticipantJoin;
  }, [onParticipantJoin]);

  // Connect to LiveKit room
  const connect = useCallback(async () => {
    if (!roomCode || state.isConnected || state.isConnecting) return;

    if (!username) {
      setState(prev => ({ ...prev, error: 'Kullanıcı adı gerekli' }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: { roomCode, odaId: roomId, username },
      });

      if (error) {
        throw new Error(error.message || 'Token alınamadı');
      }

      if (!data?.token || !data?.url) {
        throw new Error('Geçersiz token yanıtı');
      }

      console.log('LiveKit token received, connecting...');

      const room = new Room({
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      roomRef.current = room;

      room.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
        }));
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setState(prev => ({
          ...prev,
          isConnected: false,
          isMicEnabled: false,
          isScreenSharing: false,
          remoteScreenShare: null,
          participants: new Map(),
        }));
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
        const participantName = participant.name || participant.identity;
        
        if (onParticipantJoinRef.current) {
          onParticipantJoinRef.current(participantName);
        }
        
        setState(prev => {
          const newParticipants = new Map(prev.participants);
          newParticipants.set(participant.identity, {
            name: participantName,
            isSpeaking: false,
          });
          return { ...prev, participants: newParticipants };
        });
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        const audioEl = audioElementsRef.current.get(participant.identity);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
          audioElementsRef.current.delete(participant.identity);
        }

        setState(prev => {
          const newParticipants = new Map(prev.participants);
          newParticipants.delete(participant.identity);
          
          // If this participant was screen sharing, clear it
          const newRemoteScreenShare = prev.remoteScreenShare?.participantIdentity === participant.identity
            ? null
            : prev.remoteScreenShare;
          
          return { ...prev, participants: newParticipants, remoteScreenShare: newRemoteScreenShare };
        });
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setState(prev => {
          const newParticipants = new Map(prev.participants);
          newParticipants.forEach((value, key) => {
            newParticipants.set(key, { ...value, isSpeaking: false });
          });
          speakers.forEach(speaker => {
            const existing = newParticipants.get(speaker.identity);
            if (existing) {
              newParticipants.set(speaker.identity, { ...existing, isSpeaking: true });
            }
          });
          return { ...prev, participants: newParticipants };
        });
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log('Audio track subscribed from:', participant.identity);
          const audioEl = track.attach();
          audioEl.id = `audio-${participant.identity}`;
          document.body.appendChild(audioEl);
          audioElementsRef.current.set(participant.identity, audioEl);
        }
        
        // Screen share track from remote participant
        if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
          console.log('Screen share track subscribed from:', participant.identity);
          setState(prev => ({
            ...prev,
            remoteScreenShare: {
              participantIdentity: participant.identity,
              participantName: participant.name || participant.identity,
              track: track as RemoteTrack,
            },
          }));
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log('Audio track unsubscribed from:', participant.identity);
          const audioEl = audioElementsRef.current.get(participant.identity);
          if (audioEl) {
            track.detach(audioEl);
            audioEl.remove();
            audioElementsRef.current.delete(participant.identity);
          }
        }
        
        // Screen share ended
        if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
          console.log('Screen share track unsubscribed from:', participant.identity);
          setState(prev => {
            if (prev.remoteScreenShare?.participantIdentity === participant.identity) {
              return { ...prev, remoteScreenShare: null };
            }
            return prev;
          });
        }
      });

      // Detect when local screen share ends (user clicks "Stop sharing" in browser)
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          console.log('Local screen share ended');
          setState(prev => ({ ...prev, isScreenSharing: false }));
        }
      });

      await room.connect(data.url, data.token);

      // Add existing participants
      room.remoteParticipants.forEach((participant) => {
        setState(prev => {
          const newParticipants = new Map(prev.participants);
          newParticipants.set(participant.identity, {
            name: participant.name || participant.identity,
            isSpeaking: false,
          });
          return { ...prev, participants: newParticipants };
        });
        
        // Check if any existing participant is already screen sharing
        participant.trackPublications.forEach((pub) => {
          if (pub.track && pub.source === Track.Source.ScreenShare && pub.track.kind === Track.Kind.Video) {
            setState(prev => ({
              ...prev,
              remoteScreenShare: {
                participantIdentity: participant.identity,
                participantName: participant.name || participant.identity,
                track: pub.track as RemoteTrack,
              },
            }));
          }
        });
      });

    } catch (error) {
      console.error('Error connecting to LiveKit:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Bağlantı hatası',
      }));
    }
  }, [roomCode, roomId, username, state.isConnected, state.isConnecting]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    audioElementsRef.current.forEach((audioEl) => {
      audioEl.srcObject = null;
      audioEl.remove();
    });
    audioElementsRef.current.clear();

    setState({
      isConnected: false,
      isConnecting: false,
      isMicEnabled: false,
      isScreenSharing: false,
      remoteScreenShare: null,
      participants: new Map(),
      error: null,
    });
  }, []);

  // Toggle microphone
  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return;

    try {
      const room = roomRef.current;
      const localParticipant = room.localParticipant;

      if (state.isMicEnabled) {
        await localParticipant.setMicrophoneEnabled(false);
        setState(prev => ({ ...prev, isMicEnabled: false }));
      } else {
        await localParticipant.setMicrophoneEnabled(true);
        setState(prev => ({ ...prev, isMicEnabled: true }));
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
      setState(prev => ({
        ...prev,
        error: 'Mikrofon açılamadı',
      }));
    }
  }, [state.isMicEnabled]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    if (!roomRef.current || state.isScreenSharing) return;

    try {
      const room = roomRef.current;
      await room.localParticipant.setScreenShareEnabled(true);
      setState(prev => ({ ...prev, isScreenSharing: true }));
    } catch (error) {
      console.error('Error starting screen share:', error);
      // User probably cancelled the picker
      if (error instanceof Error && error.message.includes('Permission denied')) {
        return;
      }
      setState(prev => ({
        ...prev,
        error: 'Ekran paylaşımı başlatılamadı',
      }));
    }
  }, [state.isScreenSharing]);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    if (!roomRef.current || !state.isScreenSharing) return;

    try {
      const room = roomRef.current;
      await room.localParticipant.setScreenShareEnabled(false);
      setState(prev => ({ ...prev, isScreenSharing: false }));
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }, [state.isScreenSharing]);

  // Auto-connect when room code AND username are available
  useEffect(() => {
    if (roomCode && username && !state.isConnected && !state.isConnecting) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [roomCode, username]);

  return {
    ...state,
    connect,
    disconnect,
    toggleMic,
    startScreenShare,
    stopScreenShare,
  };
};
