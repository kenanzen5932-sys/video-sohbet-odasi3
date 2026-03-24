import { useState, useEffect, useCallback, useRef } from 'react';

interface DanmakuMessage {
  id: string;
  text: string;
  username: string;
  top: number; // percentage from top
  createdAt: number;
}

interface DanmakuOverlayProps {
  messages: { id: string; content: string; username: string; user_id: string; created_at: string }[];
}

const DANMAKU_DURATION = 6000; // 6 seconds
const MAX_LANES = 8;

export const DanmakuOverlay = ({ messages }: DanmakuOverlayProps) => {
  const [danmakus, setDanmakus] = useState<DanmakuMessage[]>([]);
  const lastMessageIdRef = useRef<string | null>(null);
  const laneRef = useRef(0);

  // Only show NEW messages as danmaku (not existing ones on load)
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    
    // Skip if we already processed this message or it's a system message
    if (lastMsg.id === lastMessageIdRef.current || lastMsg.user_id === 'system' || !lastMsg.content.trim()) return;
    
    lastMessageIdRef.current = lastMsg.id;

    // Assign lane (cycling through lanes to avoid overlap)
    const lane = laneRef.current % MAX_LANES;
    laneRef.current++;

    const newDanmaku: DanmakuMessage = {
      id: lastMsg.id,
      text: lastMsg.content,
      username: lastMsg.username,
      top: 5 + (lane * (90 / MAX_LANES)), // distribute across 5%-95% height
      createdAt: Date.now(),
    };

    setDanmakus(prev => [...prev, newDanmaku]);

    // Remove after duration
    setTimeout(() => {
      setDanmakus(prev => prev.filter(d => d.id !== newDanmaku.id));
    }, DANMAKU_DURATION + 500);
  }, [messages]);

  if (danmakus.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
      {danmakus.map((danmaku) => (
        <div
          key={danmaku.id}
          className="absolute whitespace-nowrap danmaku-scroll"
          style={{
            top: `${danmaku.top}%`,
            animationDuration: `${DANMAKU_DURATION}ms`,
          }}
        >
          <span className="text-white text-sm md:text-base font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {danmaku.username}: {danmaku.text}
          </span>
        </div>
      ))}
    </div>
  );
};
