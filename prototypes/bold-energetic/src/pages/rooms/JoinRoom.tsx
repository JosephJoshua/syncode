import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';

const RECENT_ROOMS = [
  { code: 'ROOM01', problem: 'Two Sum', date: 'Mar 7, 2026' },
  { code: 'ALGO42', problem: 'Add Two Numbers', date: 'Mar 6, 2026' },
  { code: 'HARD99', problem: 'Merge K Sorted Lists', date: 'Mar 5, 2026' },
];

export function JoinRoom() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  function handleCodeChange(value: string) {
    const cleaned = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    setCode(cleaned);
    if (error) setError(false);
  }

  function handleJoin() {
    if (code.length === 0) return;
    if (code === 'ERROR1') {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    } else {
      navigate(`/rooms/${code}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleJoin();
  }

  function focusInput() {
    hiddenInputRef.current?.focus();
  }

  const boxes = Array.from({ length: 6 }, (_, i) => code[i] || '');

  return (
    <div
      className="min-h-[calc(100vh-4rem)] flex items-start justify-center py-10 px-4"
      style={{ background: 'var(--gradient-surface)' }}
    >
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
          Join Room
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
          Enter the 6-character room code to join
        </p>

        <Card padding="p-6">
          {/* OTP-style input */}
          <div
            className="flex justify-center gap-2"
            style={shaking ? { animation: 'shake 0.5s' } : undefined}
            onClick={focusInput}
          >
            {boxes.map((char, i) => (
              <div
                key={i}
                className={`w-12 h-14 flex items-center justify-center rounded-lg border text-xl font-mono font-bold transition-all duration-200 ${
                  error
                    ? 'border-[var(--error)] ring-2 ring-[var(--error)]/30'
                    : i === code.length
                      ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30'
                      : 'border-[var(--border-default)]'
                }`}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }}
              >
                {char}
              </div>
            ))}
          </div>

          {/* Hidden input */}
          <input
            ref={hiddenInputRef}
            type="text"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={6}
            className="sr-only"
            aria-label="Room code"
          />

          {/* Error message */}
          {error && <p className="text-[var(--error)] text-sm mt-2 text-center">Room not found</p>}

          {/* Join button */}
          <Button className="w-full mt-4" onClick={handleJoin} disabled={code.length === 0}>
            Join
          </Button>
        </Card>

        {/* Recent Rooms */}
        <div className="mt-8">
          <h2 className="font-display text-sm font-semibold text-[var(--text-secondary)] mb-3">
            Recent Rooms
          </h2>
          <div className="space-y-2">
            {RECENT_ROOMS.map((room) => (
              <Card key={room.code} padding="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">
                      {room.code}
                    </span>
                    <span className="mx-2 text-[var(--text-tertiary)]">&middot;</span>
                    <span className="text-sm text-[var(--text-secondary)]">{room.problem}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-tertiary)]">{room.date}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/rooms/${room.code}`)}
                      className="text-sm text-[var(--primary)] hover:underline cursor-pointer font-medium"
                    >
                      Rejoin
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
