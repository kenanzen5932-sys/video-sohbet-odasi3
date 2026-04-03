import { Users, Mic, MicOff, Crown, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RoomParticipant } from '@/hooks/useRoomPresence';
import { toast } from '@/hooks/use-toast';

interface ParticipantsDialogProps {
  participants: Map<string, RoomParticipant>;
  isOwner: boolean;
  currentUser: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  isMicEnabled: boolean;
  isConnected: boolean;
  roomCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ParticipantsDialog = ({
  participants,
  isOwner,
  currentUser,
  isMicEnabled,
  isConnected,
  roomCode,
  open,
  onOpenChange,
}: ParticipantsDialogProps) => {
  const [copied, setCopied] = useState(false);
  const participantList = Array.from(participants.entries());
  const totalCount = participantList.length + 1; // Always include current user

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    toast({
      title: 'Kopyalandı!',
      description: 'Oda kodu panoya kopyalandı',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Odadaki Kullanıcılar ({totalCount})
          </DialogTitle>
        </DialogHeader>

        {/* Room code section */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Oda Kodu:</span>
            <span className="text-sm font-mono font-medium">{roomCode}</span>
          </div>
          <Button
            onClick={handleCopyCode}
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {/* Current user - always show */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10">
            <div className="flex items-center gap-2">
              <img
                src={currentUser.avatar_url || '/placeholder.svg'}
                alt={currentUser.username}
                className="w-8 h-8 rounded-full object-cover border-2 border-primary/30"
              />
              {isOwner && <Crown className="w-4 h-4 text-yellow-500" />}
              <span className="text-sm font-medium">{currentUser.username} (Sen)</span>
            </div>
            {isConnected && (
              isMicEnabled ? (
                <Mic className="w-4 h-4 text-primary" />
              ) : (
                <MicOff className="w-4 h-4 text-muted-foreground" />
              )
            )}
          </div>

          {/* Other participants */}
          {participantList.map(([id, participant]) => (
            <div
              key={id}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg bg-secondary/50',
                participant.isSpeaking && 'ring-2 ring-primary',
                participant.isBackground && 'opacity-60'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <img
                    src={participant.avatar_url || '/placeholder.svg'}
                    alt={participant.username}
                    className="w-8 h-8 rounded-full object-cover border-2 border-secondary"
                  />
                  {participant.isBackground && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center">
                      <EyeOff className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm">{participant.username}</span>
                  {participant.isBackground && (
                    <span className="text-[10px] text-amber-500">Arka planda</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {participant.isSpeaking ? (
                  <Mic className="w-4 h-4 text-primary animate-pulse" />
                ) : (
                  <MicOff className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}

          {totalCount === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Henüz bağlanan yok
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
