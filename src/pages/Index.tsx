import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Loader2, Play } from 'lucide-react';
import neofilmLogo from '@/assets/neofilm-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
const generateRoomCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};
const Index = () => {
  const navigate = useNavigate();
  const {
    user,
    profile
  } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const handleCreateRoom = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const code = generateRoomCode();
      const {
        data: roomData,
        error: roomError
      } = await supabase.from('rooms').insert({
        code,
        owner_id: user.id
      }).select().single();
      if (roomError) throw roomError;

      // Create initial video state
      await supabase.from('video_state').insert({
        room_id: roomData.id,
        video_url: null,
        is_playing: false,
        playback_time: 0
      });
      navigate(`/room/${code}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: 'Hata',
        description: 'Oda oluşturulurken bir hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };
  const handleJoinRoom = async () => {
    if (!roomCode.trim() || roomCode.length !== 5) {
      toast({
        title: 'Hata',
        description: 'Lütfen 5 haneli oda kodunu girin',
        variant: 'destructive'
      });
      return;
    }
    setIsJoining(true);
    try {
      const {
        data,
        error
      } = await supabase.from('rooms').select('code').eq('code', roomCode.trim()).maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({
          title: 'Hata',
          description: 'Bu kodla bir oda bulunamadı',
          variant: 'destructive'
        });
        return;
      }
      navigate(`/room/${roomCode.trim()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: 'Hata',
        description: 'Odaya katılırken bir hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setIsJoining(false);
    }
  };
  return <div className="min-h-screen cinema-gradient flex flex-col items-center justify-center p-6">
      {/* Profile Avatar - Top Right */}
      <button onClick={() => navigate('/profile')} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-secondary/50 border border-border/50 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" /> : <span className="text-sm font-medium text-foreground">
            {profile?.username?.charAt(0).toUpperCase() || 'K'}
          </span>}
      </button>

      {/* Logo */}
      <img src={neofilmLogo} alt="KATHENA FİLM" className="w-96 h-96 mx-auto -mt-24 -mb-12 object-contain animate-fade-in" />
      
      {/* Title & Description */}
      <div className="text-center mb-6 animate-fade-in -mt-16">
        <h1 className="text-3xl font-bold glow-text">KATHENA FİLM</h1>
        <p className="text-muted-foreground mt-2">
          Arkadaşlarınla senkronize video izle
        </p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-4 animate-slide-up">
        <Button onClick={handleCreateRoom} disabled={isCreating} className="w-full h-14 text-lg font-medium bg-primary hover:bg-primary/90 glow-primary">
          {isCreating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
          Oda Kur
        </Button>

        {!showJoinInput ? <Button onClick={() => setShowJoinInput(true)} variant="secondary" className="w-full h-14 text-lg font-medium">
            <Users className="w-5 h-5 mr-2" />
            Odaya Katıl
          </Button> : <div className="space-y-3 animate-fade-in">
            <div className="relative">
              <Input value={roomCode} onChange={e => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="5 haneli oda kodu" className="h-14 text-lg text-center tracking-[0.5em] bg-input border-border/50 placeholder:tracking-normal" maxLength={5} inputMode="numeric" autoFocus />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => {
            setShowJoinInput(false);
            setRoomCode('');
          }} variant="ghost" className="flex-1 h-12">
                İptal
              </Button>
              <Button onClick={handleJoinRoom} disabled={isJoining || roomCode.length !== 5} className="flex-1 h-12 bg-primary hover:bg-primary/90">
                {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                    Katıl
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>}
              </Button>
            </div>
          </div>}
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground mt-12 text-center animate-fade-in">
        ​DEVELOPER / NEO               


      </p>
    </div>;
};
export default Index;