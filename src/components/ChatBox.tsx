import { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  image_url?: string | null;
  avatar_url?: string | null;
}

interface ChatBoxProps {
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string, imageFile?: File) => void;
  onClearMessages?: () => void;
  isOwner?: boolean;
  loading?: boolean;
}

export const ChatBox = ({ 
  messages, 
  currentUserId, 
  onSendMessage,
  onClearMessages,
  isOwner = false,
  loading 
}: ChatBoxProps) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;
    
    setUploading(true);
    await onSendMessage(input, selectedImage || undefined);
    setInput('');
    clearImage();
    setUploading(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full max-h-full lg:max-h-none overflow-hidden bg-card/50 rounded-lg border border-border/30">
      {/* Chat Header */}
      <div className="px-2 py-1 border-b border-border/30 flex items-center justify-between">
        <h3 className="font-medium text-xs text-foreground/90">Sohbet</h3>
        {isOwner && onClearMessages && messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sohbeti Temizle</AlertDialogTitle>
                <AlertDialogDescription>
                  Tüm mesajlar silinecek. Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={onClearMessages}>
                  Temizle
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Messages Container */}
      <div 
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1 scrollbar-thin"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Yükleniyor...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Henüz mesaj yok</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.user_id === currentUserId;
            const isSystem = message.user_id === 'system';

            if (isSystem) {
              return (
                <div
                  key={message.id}
                  className="flex justify-center py-1 animate-fade-in"
                >
                  <span className="text-xs text-muted-foreground italic bg-secondary/30 px-2 py-0.5 rounded-full">
                    {message.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={cn(
                  'flex animate-fade-in gap-2',
                  isOwn ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {message.avatar_url ? (
                    <img 
                      src={message.avatar_url} 
                      alt={message.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {message.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className={cn('flex flex-col min-w-0 max-w-[85%]', isOwn ? 'items-end' : 'items-start')}>
                  <span className={cn(
                    "text-xs font-medium mb-1",
                    isOwn ? "text-foreground" : "text-primary"
                  )}>
                    {message.username}
                  </span>
                  <div
                    className={cn(
                      'px-3 py-2 rounded-2xl break-words overflow-hidden',
                      isOwn 
                        ? 'bg-chat-own text-foreground rounded-tr-sm' 
                        : 'bg-chat-bubble text-foreground rounded-tl-sm'
                    )}
                  >
                    {message.image_url && (
                      <img 
                        src={message.image_url} 
                        alt="Gönderilen görsel"
                        className="w-32 h-32 object-cover rounded-lg cursor-pointer mb-2 hover:opacity-90 transition-opacity"
                        onClick={() => setExpandedImage(message.image_url!)}
                      />
                    )}
                    {message.content && (
                      <p className="text-sm break-words overflow-wrap-anywhere">{message.content}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {previewUrl && (
        <div className="px-3 py-2 border-t border-border/30 bg-secondary/30">
          <div className="relative inline-block">
            <img 
              src={previewUrl} 
              alt="Önizleme" 
              className="w-16 h-16 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="px-2 py-1.5 border-t border-border/30">
        <div className="flex gap-2 items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="w-5 h-5" />
          </Button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mesaj yazın..."
            className="flex-1 h-10 px-3 py-2 bg-input border border-border/50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            enterKeyHint="send"
            autoComplete="off"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={(!input.trim() && !selectedImage) || uploading}
            className="bg-primary hover:bg-primary/90 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {/* Expanded Image Dialog */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95">
          <DialogTitle className="sr-only">Görsel</DialogTitle>
          {expandedImage && (
            <img 
              src={expandedImage} 
              alt="Büyütülmüş görsel"
              className="w-full h-full object-contain max-h-[85vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
