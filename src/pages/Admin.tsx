import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Tv, BarChart3, Trash2, Play, Pause, Edit, ArrowLeft, UserCircle, Eye, EyeOff, MessageCircle, Mic, MicOff, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { AdminGiftSender } from '@/components/AdminGiftSender';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RoomParticipant {
  id: string;
  username: string;
  avatar_url: string | null;
  isSpeaking?: boolean;
  isBackground?: boolean;
}

interface ChatMessage {
  id: string;
  content: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  image_url?: string | null;
}

interface Room {
  id: string;
  code: string;
  owner_id: string;
  created_at: string;
  video_state?: {
    video_url: string | null;
    is_playing: boolean;
    playback_time: number;
  };
  owner_profile?: {
    username: string;
    avatar_url: string | null;
  };
  activeParticipants?: number;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [viewingRoom, setViewingRoom] = useState<Room | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>([]);
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'gift'>('participants');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messageChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/', { replace: true });
      return;
    }

    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, adminLoading, navigate]);

  // Cleanup channels on unmount or when dialog closes
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
      }
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch rooms with video state
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (roomsData) {
      // Fetch video states and owner profiles for each room
      const roomsWithDetails = await Promise.all(
        roomsData.map(async (room) => {
          const { data: videoState } = await supabase
            .from('video_state')
            .select('video_url, is_playing, playback_time')
            .eq('room_id', room.id)
            .single();

          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', room.owner_id)
            .single();

          return {
            ...room,
            video_state: videoState || undefined,
            owner_profile: ownerProfile || undefined
          };
        })
      );
      setRooms(roomsWithDetails);
    }

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesData) {
      setProfiles(profilesData);
    }

    setLoading(false);
  };

  const handleDeleteRoom = async (roomId: string) => {
    // First delete related data
    await supabase.from('messages').delete().eq('room_id', roomId);
    await supabase.from('video_state').delete().eq('room_id', roomId);
    
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      toast.error('Oda silinemedi');
    } else {
      toast.success('Oda silindi');
      fetchData();
    }
  };

  const handleTogglePlay = async (roomId: string, currentlyPlaying: boolean) => {
    const { error } = await supabase
      .from('video_state')
      .update({ is_playing: !currentlyPlaying, updated_at: new Date().toISOString() })
      .eq('room_id', roomId);

    if (error) {
      toast.error('Durum güncellenemedi');
    } else {
      toast.success(currentlyPlaying ? 'Video duraklatıldı' : 'Video oynatılıyor');
      fetchData();
    }
  };

  const handleUpdateVideoUrl = async () => {
    if (!editingRoom) return;

    const { error } = await supabase
      .from('video_state')
      .update({ video_url: newVideoUrl, updated_at: new Date().toISOString() })
      .eq('room_id', editingRoom.id);

    if (error) {
      toast.error('Video URL güncellenemedi');
    } else {
      toast.success('Video URL güncellendi');
      setEditingRoom(null);
      setNewVideoUrl('');
      fetchData();
    }
  };

  const handleClearChat = async (roomId: string) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('room_id', roomId);

    if (error) {
      toast.error('Sohbet temizlenemedi');
    } else {
      toast.success('Sohbet temizlendi');
    }
  };

  const handleDeleteAllRooms = async () => {
    // Delete all messages first
    await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Delete all video states
    await supabase.from('video_state').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { error } = await supabase
      .from('rooms')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      toast.error('Odalar silinemedi');
    } else {
      toast.success('Tüm odalar silindi');
      setDeleteAllConfirm(false);
      fetchData();
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile) return;

    const updates: { username?: string; avatar_url?: string } = {};
    if (newUsername.trim()) updates.username = newUsername.trim();
    if (newAvatarUrl.trim()) updates.avatar_url = newAvatarUrl.trim();

    if (Object.keys(updates).length === 0) {
      toast.error('En az bir alan doldurun');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', editingProfile.id);

    if (error) {
      console.error('Profile update error:', error);
      toast.error('Profil güncellenemedi: ' + error.message);
    } else {
      toast.success('Profil güncellendi');
      setEditingProfile(null);
      setNewUsername('');
      setNewAvatarUrl('');
      fetchData();
    }
  };

  const handleViewRoom = async (room: Room) => {
    setViewingRoom(room);
    setActiveTab('participants');
    setRoomParticipants([]);
    setRoomMessages([]);

    // Cleanup previous channels
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
    }

    // Subscribe to presence for this room - CORRECT channel name
    const presenceChannel = supabase.channel(`room-presence:${room.code}`, {
      config: {
        presence: {
          key: 'admin-viewer',
        },
      },
    });
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const participants: RoomParticipant[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as unknown as RoomParticipant;
            participants.push({
              id: presence.id || key,
              username: presence.username || 'Bilinmiyor',
              avatar_url: presence.avatar_url || null,
              isSpeaking: presence.isSpeaking || false,
            });
          }
        });
        
        setRoomParticipants(participants);
      })
      .subscribe();

    channelRef.current = presenceChannel;

    // Fetch initial messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (messages) {
      setRoomMessages(messages.reverse());
    }

    // Subscribe to new messages
    const msgChannel = supabase
      .channel(`admin-messages:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setRoomMessages((prev) => [...prev, newMessage]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`
        },
        () => {
          setRoomMessages([]);
        }
      )
      .subscribe();

    messageChannelRef.current = msgChannel;
  };

  const handleCloseViewRoom = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }
    setViewingRoom(null);
    setRoomParticipants([]);
    setRoomMessages([]);
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen cinema-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen cinema-gradient p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Admin Paneli</h1>
        </div>

        <Tabs defaultValue="rooms" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6">
            <TabsTrigger value="rooms" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
              <Tv className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Odalar</span>
              <span className="sm:hidden">Oda</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Kullanıcılar</span>
              <span className="sm:hidden">Kull.</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">İstatistikler</span>
              <span className="sm:hidden">İstat.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rooms">
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg">Aktif Odalar ({rooms.length})</CardTitle>
                  {rooms.length > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setDeleteAllConfirm(true)}
                      className="text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Tümünü Sil
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-6">
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {rooms.map((room) => (
                    <Card key={room.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-primary">{room.code}</span>
                        <span className={`text-xs ${room.video_state?.is_playing ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {room.video_state?.is_playing ? '▶ Oynatılıyor' : '⏸ Duraklatıldı'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={room.owner_profile?.avatar_url || ''} />
                          <AvatarFallback className="text-xs">{room.owner_profile?.username?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{room.owner_profile?.username || 'Bilinmiyor'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-3">
                        {room.video_state?.video_url || 'Video yok'}
                      </p>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewRoom(room)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleTogglePlay(room.id, room.video_state?.is_playing || false)}>
                          {room.video_state?.is_playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingRoom(room); setNewVideoUrl(room.video_state?.video_url || ''); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleClearChat(room.id)}>
                          <Trash2 className="w-4 h-4 text-yellow-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRoom(room.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {rooms.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Henüz oda yok</p>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kod</TableHead>
                        <TableHead>Sahip</TableHead>
                        <TableHead>Video</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead>Eylemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rooms.map((room) => (
                        <TableRow key={room.id}>
                          <TableCell className="font-mono font-bold">{room.code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={room.owner_profile?.avatar_url || ''} />
                                <AvatarFallback>{room.owner_profile?.username?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{room.owner_profile?.username || 'Bilinmiyor'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {room.video_state?.video_url || 'Video yok'}
                          </TableCell>
                          <TableCell>
                            {room.video_state?.is_playing ? (
                              <span className="text-green-500 text-sm">Oynatılıyor</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Duraklatıldı</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleViewRoom(room)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleTogglePlay(room.id, room.video_state?.is_playing || false)}>
                                {room.video_state?.is_playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setEditingRoom(room); setNewVideoUrl(room.video_state?.video_url || ''); }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleClearChat(room.id)}>
                                <Trash2 className="w-4 h-4 text-yellow-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {rooms.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Henüz oda yok
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Kayıtlı Kullanıcılar ({profiles.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-2 sm:p-6">
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {profiles.map((profile) => (
                    <Card key={profile.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={profile.avatar_url || ''} />
                            <AvatarFallback>{profile.username[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{profile.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(profile.created_at).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setEditingProfile(profile);
                            setNewUsername(profile.username);
                            setNewAvatarUrl(profile.avatar_url || '');
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Avatar</TableHead>
                        <TableHead>Kullanıcı Adı</TableHead>
                        <TableHead>Kayıt Tarihi</TableHead>
                        <TableHead>Eylemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={profile.avatar_url || ''} />
                              <AvatarFallback>{profile.username[0]}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{profile.username}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(profile.created_at).toLocaleDateString('tr-TR')}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingProfile(profile);
                                setNewUsername(profile.username);
                                setNewAvatarUrl(profile.avatar_url || '');
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Toplam Oda</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold">{rooms.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Toplam Kullanıcı</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold">{profiles.length}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Video URL Edit Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={() => setEditingRoom(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Video URL Düzenle</DialogTitle>
          </DialogHeader>
          <Input
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="HLS veya YouTube URL girin"
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingRoom(null)} className="w-full sm:w-auto">
              İptal
            </Button>
            <Button onClick={handleUpdateVideoUrl} className="w-full sm:w-auto">
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Edit Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              Profil Düzenle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <Avatar className="w-16 h-16">
                <AvatarImage src={newAvatarUrl || editingProfile?.avatar_url || ''} />
                <AvatarFallback className="text-xl">{editingProfile?.username[0]}</AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input
                id="username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Yeni kullanıcı adı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                value={newAvatarUrl}
                onChange={(e) => setNewAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingProfile(null)} className="w-full sm:w-auto">
              İptal
            </Button>
            <Button onClick={handleUpdateProfile} className="w-full sm:w-auto">
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Details Dialog - Participants & Chat */}
      <Dialog open={!!viewingRoom} onOpenChange={handleCloseViewRoom}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Oda Detayları - {viewingRoom?.code}
            </DialogTitle>
          </DialogHeader>
          
          {/* Tabs for Participants and Chat */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'participants' 
                  ? 'border-b-2 border-primary text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              Katılımcılar ({roomParticipants.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 px-3 text-sm font-medium flex items-center justify-center gap-1.5 ${
                activeTab === 'chat' 
                  ? 'border-b-2 border-primary text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Sohbet</span> ({roomMessages.length})
            </button>
            <button
              onClick={() => setActiveTab('gift')}
              className={`flex-1 py-2 px-3 text-sm font-medium flex items-center justify-center gap-1.5 ${
                activeTab === 'gift' 
                  ? 'border-b-2 border-amber-500 text-amber-500' 
                  : 'text-muted-foreground'
              }`}
            >
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">Hediye</span>
            </button>
          </div>

          <ScrollArea className="h-[350px]">
            {activeTab === 'participants' ? (
              <div className="space-y-2 p-2">
                {roomParticipants.length > 0 ? (
                  roomParticipants.map((participant, index) => (
                    <div key={participant.id || index} className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 ${participant.isBackground ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={participant.avatar_url || ''} />
                            <AvatarFallback>{participant.username[0]}</AvatarFallback>
                          </Avatar>
                          {participant.isBackground && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center">
                              <EyeOff className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{participant.username}</span>
                          {participant.isBackground && (
                            <span className="text-[10px] text-amber-500">Arka planda</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {participant.isSpeaking ? (
                          <div className="flex items-center gap-1 text-green-500">
                            <Mic className="w-4 h-4" />
                            <span className="text-xs">Açık</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MicOff className="w-4 h-4" />
                            <span className="text-xs">Kapalı</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Şu anda odada kimse yok
                  </p>
                )}
              </div>
            ) : activeTab === 'chat' ? (
              <div className="space-y-2 p-2">
                {roomMessages.length > 0 ? (
                  roomMessages.map((message) => (
                    <div key={message.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                      <Avatar className="w-6 h-6 flex-shrink-0">
                        <AvatarImage src={message.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{message.username[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium text-primary">{message.username}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm break-words">{message.content}</p>
                        {message.image_url && (
                          <img 
                            src={message.image_url} 
                            alt="Mesaj resmi" 
                            className="mt-1 max-w-[150px] rounded-md cursor-pointer"
                          />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Henüz mesaj yok
                  </p>
                )}
              </div>
            ) : (
              <AdminGiftSender
                roomCode={viewingRoom?.code || ''}
                participants={roomParticipants}
              />
            )}
          </ScrollArea>

          <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
            <span>Oda Sahibi: {viewingRoom?.owner_profile?.username || 'Bilinmiyor'}</span>
            <span>Kod: {viewingRoom?.code}</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Rooms Confirmation Dialog */}
      <Dialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Tüm Odaları Sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bu işlem tüm odaları, mesajları ve video durumlarını kalıcı olarak silecek. Devam etmek istiyor musunuz?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteAllConfirm(false)} className="w-full sm:w-auto">
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllRooms} className="w-full sm:w-auto">
              Tümünü Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;