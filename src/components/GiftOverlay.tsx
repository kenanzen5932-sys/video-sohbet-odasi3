import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

interface GiftData {
  recipientUsername: string;
  recipientAvatarUrl: string | null;
  note: string;
  imageUrl: string | null;
  senderName: string;
}

interface GiftOverlayProps {
  roomCode: string;
  currentUsername: string;
}

export const GiftOverlay = ({ roomCode, currentUsername }: GiftOverlayProps) => {
  const [gift, setGift] = useState<GiftData | null>(null);
  const [phase, setPhase] = useState<'closed' | 'opening' | 'opened'>('closed');
  const isRecipient = gift?.recipientUsername === currentUsername;

  useEffect(() => {
    if (!roomCode) return;

    const channel = supabase.channel(`gift:${roomCode}`);
    channel
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        setGift(payload as GiftData);
        setPhase('closed');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  const handleOpenGift = useCallback(() => {
    setPhase('opening');
    // Fire confetti
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4', '#a855f7'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // Big burst
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors,
      startVelocity: 45,
    });

    setTimeout(() => setPhase('opened'), 600);
  }, []);

  const handleClose = () => {
    setGift(null);
    setPhase('closed');
  };

  if (!gift) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-sm mx-auto">
        {/* Gift Card */}
        <div className="bg-gradient-to-br from-amber-500/20 via-background to-pink-500/20 border border-amber-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          
          {/* Sparkle decoration */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Gift className="w-10 h-10 text-white" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-pulse" />
              <Sparkles className="absolute -bottom-1 -left-2 w-5 h-5 text-pink-400 animate-pulse" />
            </div>
          </div>

          {/* Recipient info */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{gift.senderName} tarafından</p>
            <h2 className="text-lg font-bold text-foreground">
              🎁 {gift.recipientUsername} için hediye!
            </h2>
          </div>

          {phase === 'closed' && (
            <div className="space-y-3">
              {isRecipient ? (
                <Button
                  onClick={handleOpenGift}
                  className="w-full bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 text-white font-bold text-base py-6 rounded-xl shadow-lg"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  Hediyeni Aç! 🎉
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {gift.recipientUsername} hediyesini açmasını bekleyin...
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs">
                    Kapat
                  </Button>
                </div>
              )}
            </div>
          )}

          {(phase === 'opening' || phase === 'opened') && (
            <div className="space-y-4 animate-scale-in">
              {/* Note */}
              {gift.note && (
                <div className="bg-muted/50 rounded-xl p-4 border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{gift.note}</p>
                </div>
              )}

              {/* Image */}
              {gift.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-border shadow-md">
                  <img
                    src={gift.imageUrl}
                    alt="Hediye görseli"
                    className="w-full max-h-[200px] object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              <Button variant="secondary" size="sm" onClick={handleClose} className="w-full">
                Kapat
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
