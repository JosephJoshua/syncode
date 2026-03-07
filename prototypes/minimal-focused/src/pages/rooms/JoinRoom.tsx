import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { rooms } from '../../data/rooms';

export function JoinRoom() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    const room = rooms.find((r) => r.code === trimmed);
    if (!room) {
      setError('Room not found');
      return;
    }
    setError('');
    navigate(`/rooms/${room.code}/lobby`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase();
    setCode(value);
    if (error) setError('');
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
        // join_room
      </span>
      <h1 className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
        Join a Room
      </h1>

      {/* Room code input */}
      <div className="mt-6">
        <input
          type="text"
          value={code}
          onChange={handleChange}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          maxLength={6}
          placeholder="______"
          className="h-12 w-full text-center font-mono text-2xl tracking-[0.5em] uppercase rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)] focus:outline-none transition-colors"
        />
        {error && <p className="mt-1.5 font-mono text-xs text-[var(--error)]">{error}</p>}
      </div>

      {/* Join button */}
      <Button variant="primary" size="lg" className="w-full mt-4" onClick={handleJoin}>
        Join
      </Button>

      {/* Browse link */}
      <p className="mt-6 text-center">
        <Link to="/rooms" className="font-mono text-sm text-[var(--accent)] hover:underline">
          Or browse available rooms
        </Link>
      </p>
    </div>
  );
}
