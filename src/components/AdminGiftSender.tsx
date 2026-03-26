import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Send, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface Participant {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface AdminGiftSenderProps {
  roomCode: string;
  participants: Participant[];
}

export const AdminGiftSender = ({ roomCode, participants }: AdminGiftSenderProps) => {
  const [selectedUser, setSelectedUser] = useState<Participant | null>(null);
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedUser) {
      toast.error('Bir kullanıcı seçin');
      return;
    }
    if (!note.trim()) {
      toast.error('Bir not yazın');
      return;
    }

    setSending(true);
    try {
      const channel = supabase.channel(`gift:${roomCode}`);
      
      // Need to subscribe first before sending
      await new Promise<void>((resolve, reject) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') reject(new Error('Channel error'));
        });
      });

      await channel.send({
        type: 'broadcast',
        event: 'gift',
        payload: {
          recipientUsername: selectedUser.username,
          recipientAvatarUrl: selectedUser.avatar_url,
          note: note.trim(),
          imageUrl: imageUrl.trim() || null,
          senderName: 'Admin',
        },
      });

      supabase.removeChannel(channel);
      toast.success(`${selectedUser.username} adlı kullanıcıya hediye gönderildi! 🎁`);
      setSelectedUser(null);
      setNote('');
      setImageUrl('');
    } catch (err) {
      console.error('Gift send error:', err);
      toast.error('Hediye gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 p-2">
      {/* User selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5 text-amber-500" />
          Kullanıcı Seç
        </Label>
        {participants.length > 0 ? (
          <div className="grid gap-2">
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedUser(p)}
                className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                  selectedUser?.id === p.id
                    ? 'bg-amber-500/20 border border-amber-500/50 ring-1 ring-amber-500/30'
                    : 'bg-muted/50 hover:bg-muted border border-transparent'
                }`}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={p.avatar_url || ''} />
                  <AvatarFallback>{p.username[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{p.username}</span>
                {selectedUser?.id === p.id && (
                  <span className="ml-auto text-xs text-amber-500">✓ Seçildi</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm py-4">
            Odada aktif kullanıcı yok
          </p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="gift-note" className="text-xs font-medium">Not</Label>
        <Textarea
          id="gift-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hediye ile birlikte görünecek not..."
          className="min-h-[80px] resize-none"
          maxLength={500}
        />
      </div>

      {/* Image URL */}
      <div className="space-y-2">
        <Label htmlFor="gift-image" className="text-xs font-medium flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" />
          Görsel URL (opsiyonel)
        </Label>
        <Input
          id="gift-image"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Önizleme"
            className="w-full max-h-[120px] object-cover rounded-lg border border-border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>

      {/* Send button */}
      <Button
        onClick={handleSend}
        disabled={!selectedUser || !note.trim() || sending}
        className="w-full bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 text-white font-bold"
      >
        <Send className="w-4 h-4 mr-2" />
        {sending ? 'Gönderiliyor...' : 'Hediye Gönder 🎁'}
      </Button>
    </div>
  );
};
