import { CONTROL_API } from '@syncode/contracts';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Loader2,
  type LucideIcon,
  Play,
  Terminal,
  UserCog,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, readApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/rooms/$roomId')({
  component: RoomLobbyPage,
});

// ─── 1. ATOMS ────────────────────────
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`bg-[#0a0a0a] border border-zinc-800/80 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)] ${className}`}
  >
    {children}
  </div>
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
};

const Button = ({ children, variant = 'primary', type = 'button', ...props }: ButtonProps) => {
  const baseStyle =
    'w-full font-bold py-3.5 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2.5 text-base tracking-wide';
  const variants = {
    primary:
      'bg-[oklch(0.88_0.22_165)] hover:bg-[oklch(0.94_0.22_165)] text-zinc-950 shadow-[0_0_30px_oklch(0.88_0.22_165/0.5)] hover:shadow-[0_0_40px_oklch(0.88_0.22_165/0.7)] active:scale-[0.98]',
    secondary:
      'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 active:scale-[0.98]',
  };
  return (
    <button type={type} className={`${baseStyle} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
};

const Badge = ({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) => (
  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/80 text-zinc-200 text-sm font-medium">
    {Icon && <Icon size={16} className="text-[oklch(0.88_0.22_165)]" />}
    {children}
  </span>
);

// ─── 2. TYPES & MOCK DATA ─────────────────────────────────────
type Role = 'host' | 'interviewer' | 'candidate' | 'spectator' | 'unassigned';

type Participant = {
  id: string;
  username: string;
  isReady: boolean;
  isHost?: boolean;
  role: Role;
};

const formatRoleLabel = (role: Role) => {
  switch (role) {
    case 'host':
      return 'Host';
    case 'candidate':
      return 'Candidate';
    case 'interviewer':
      return 'Interviewer';
    case 'spectator':
      return 'Observer';
    default:
      return 'Unassigned';
  }
};

// ─── 3. MAIN PAGE COMPONENT ─────────────────────────────────────
function RoomLobbyPage() {
  const { roomId } = Route.useParams();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  const [myRole, setMyRole] = useState<Role>('unassigned');

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const joinRoom = async () => {
      try {
        const url = new URL(window.location.href);
        const roomCode = url.searchParams.get('code')?.toUpperCase();

        const applyDetail = (
          detail: Awaited<ReturnType<typeof api<typeof CONTROL_API.ROOMS.GET>>>,
          resolvedRole: Role,
        ) => {
          setParticipants(
            detail.participants.map((participant) => {
              const baseName = participant.displayName ?? participant.username;
              const isMe = participant.userId === currentUserId;
              return {
                id: participant.userId,
                username: isMe ? `${baseName} (You)` : baseName,
                isReady: false,
                isHost: participant.role === 'host',
                role: participant.role,
              };
            }),
          );
          setMyRole(resolvedRole);
        };

        if (roomCode) {
          const joined = await api(CONTROL_API.ROOMS.JOIN, {
            params: { id: roomId },
            body: { roomCode },
          });

          applyDetail(joined.room, joined.assignedRole);
        } else {
          const detail = await api(CONTROL_API.ROOMS.GET, {
            params: { id: roomId },
          });
          applyDetail(detail, detail.myRole);
        }

        setJoinError(null);
        setIsJoining(false);
      } catch (error) {
        const apiError = await readApiError(error);
        const fallbackAllowed = apiError?.code === 'ROOM_ALREADY_JOINED';

        if (fallbackAllowed) {
          try {
            const detail = await api(CONTROL_API.ROOMS.GET, {
              params: { id: roomId },
            });

            setParticipants(
              detail.participants.map((participant) => {
                const baseName = participant.displayName ?? participant.username;
                const isMe = participant.userId === currentUserId;
                return {
                  id: participant.userId,
                  username: isMe ? `${baseName} (You)` : baseName,
                  isReady: false,
                  isHost: participant.role === 'host',
                  role: participant.role,
                };
              }),
            );
            setMyRole(detail.myRole);
            setJoinError(null);
            setIsJoining(false);
            return;
          } catch {
            // Fall through to error state below.
          }
        }

        setJoinError(
          apiError?.message ?? 'Failed to join room. Please check invite link or login state.',
        );
        setIsJoining(false);
      }
    };
    joinRoom();
  }, [roomId, currentUserId]);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as Role;
    setMyRole(newRole);
    setParticipants((prev) =>
      prev.map((p) => (p.id === currentUserId ? { ...p, role: newRole } : p)),
    );
  };

  const toggleReady = async () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    setParticipants((prev) =>
      prev.map((p) => (p.id === currentUserId ? { ...p, isReady: newReadyState } : p)),
    );
  };
  if (joinError) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-zinc-100 px-4">
        <AlertTriangle
          size={42}
          className="text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)] mb-4"
        />
        <h2 className="text-xl font-bold tracking-wide text-zinc-200">Unable to join room</h2>
        <p className="mt-2 text-sm text-zinc-400 text-center max-w-md">{joinError}</p>
      </div>
    );
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isJoining) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-zinc-100">
        <Loader2
          size={48}
          className="animate-spin text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_15px_oklch(0.88_0.22_165/0.8)] mb-6"
        />
        <h2 className="text-xl font-bold tracking-widest uppercase text-zinc-300">
          Establishing Connection...
        </h2>
        <p className="text-zinc-500 mt-2 text-sm font-mono">
          Authenticating and joining workspace {roomId.slice(0, 8)}...
        </p>
      </div>
    );
  }

  // ─── 状态计算 ──────────────────────────────────────────────
  const allReady = participants.every((p) => p.isReady);
  const readyCount = participants.filter((p) => p.isReady).length;
  const totalCount = participants.length;

  // 校验逻辑：是否同时拥有面试官和候选人
  const hasCandidate = participants.some((p) => p.role === 'candidate');
  const hasInterviewer = participants.some((p) => p.role === 'interviewer');
  const isRoomValid = hasCandidate && hasInterviewer;

  const asciiBarBoxes = Array.from({ length: totalCount })
    .map((_, i) => (i < readyCount ? '■' : '□'))
    .join(' ');
  const asciiProgress = `[ ${asciiBarBoxes} ]`;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 py-12 px-4 flex flex-col items-center justify-start">
      <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Header Section */}
        <div className="mb-14 text-center space-y-6">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-zinc-900/50 border border-zinc-800">
            <Terminal
              size={32}
              className="text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_12px_oklch(0.88_0.22_165/0.6)]"
            />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-white">Workspace Lobby</h1>

          {/* 🎯 修改点：徽章与复制链接放到同一行布局 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-3xl mx-auto">
            <Badge icon={Users}>
              {readyCount} / {totalCount} Ready
            </Badge>

            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 focus-within:border-[oklch(0.60_0.22_165)] focus-within:shadow-[0_0_15px_oklch(0.60_0.22_165/0.5)] transition-all duration-300 w-full sm:w-[420px]">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 bg-transparent border-none outline-none text-zinc-300 text-sm px-3.5 w-full font-mono"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center justify-center shrink-0"
                title="Copy link"
              >
                {copied ? (
                  <Check
                    size={16}
                    className="text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_8px_oklch(0.88_0.22_165/0.6)]"
                  />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>

          {/* 🎯 修改点：警告横幅移到了这里（复制网址的下方） */}
          {allReady && !isRoomValid && (
            <div className="w-full max-w-2xl mx-auto mt-6 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-4 flex items-center justify-center gap-3 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                <AlertTriangle size={20} className="shrink-0" />
                <span className="font-semibold text-sm">
                  Action Required: Ensure at least one Candidate and one Interviewer are assigned to
                  start.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Participants Grid (左侧区域) */}
          <div className="lg:col-span-8">
            <h2 className="font-mono text-base text-[oklch(0.88_0.22_165)]/70 mb-5 tracking-wide">
              {/* connected_peers */}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {participants.map((participant) => (
                <Card
                  key={participant.id}
                  className={`p-5 transition-all duration-300 border ${
                    participant.isReady
                      ? 'border-[oklch(0.60_0.22_165)] bg-zinc-900/80 shadow-[0_0_20px_oklch(0.60_0.22_165/0.15)]'
                      : 'border-zinc-800/80 bg-[#0a0a0a]'
                  }`}
                >
                  {/* 🎯 修复 2: items-center 确保头像、文字和打勾在同一水平线居中 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-300 shrink-0">
                        {participant.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-100 text-[15px] flex items-center gap-2">
                          {participant.username}
                          {participant.isHost && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase text-zinc-950 bg-zinc-300 tracking-wider font-bold">
                              Host
                            </span>
                          )}
                        </span>
                        {/* 🎯 修复 3: 角色字号变大(text-sm)，颜色变为发光 oklch */}
                        <span
                          className={`text-sm mt-1 font-mono flex items-center gap-1.5 ${
                            participant.role === 'unassigned'
                              ? 'text-zinc-500'
                              : 'text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_5px_oklch(0.88_0.22_165/0.3)]'
                          }`}
                        >
                          <UserCog size={14} />
                          {formatRoleLabel(participant.role)}
                        </span>
                      </div>
                    </div>
                    {/* 打勾容器居中 */}
                    <div className="flex flex-col items-end justify-center">
                      {participant.isReady ? (
                        <CheckCircle2
                          size={24}
                          className="text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_8px_oklch(0.88_0.22_165/0.8)]"
                        />
                      ) : (
                        <Circle size={24} className="text-zinc-700" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Action Panel (右侧区域) */}
          <div className="lg:col-span-4 mt-8 lg:mt-0">
            <h2 className="font-mono text-base text-[oklch(0.88_0.22_165)]/70 mb-5 tracking-wide">
              {/* your_status */}
            </h2>
            <Card className="p-7 sticky top-6">
              <div className="space-y-7">
                {/* 🎯 修复 4: 移除外边框和背景，让 ASCII 进度条直接展示 */}
                <div className="font-mono text-center pt-2 pb-4">
                  <div
                    className={`text-2xl mb-3 transition-colors duration-500 ${allReady ? 'text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_12px_oklch(0.88_0.22_165/0.8)]' : 'text-zinc-500'}`}
                  >
                    {asciiProgress}
                  </div>
                  <div
                    className={`text-xs tracking-widest ${allReady ? 'text-[oklch(0.88_0.22_165)]' : 'text-[oklch(0.88_0.22_165)]/50 animate-pulse'}`}
                  >
                    {allReady ? '> SYSTEM_READY' : '> AWAITING_PEERS_'}
                  </div>
                </div>

                {/* 角色选择器 */}
                <div className="space-y-2.5">
                  <label
                    htmlFor="role-select"
                    className="text-xs font-semibold uppercase tracking-widest text-zinc-500"
                  >
                    Select Your Role
                  </label>
                  <div className="relative">
                    <select
                      id="role-select"
                      value={myRole}
                      onChange={handleRoleChange}
                      disabled={isReady} // 准备后不可更改角色
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg p-3 appearance-none focus:border-[oklch(0.60_0.22_165)] focus:shadow-[0_0_15px_oklch(0.60_0.22_165/0.5)] outline-none transition-all duration-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="unassigned">Pick a role...</option>
                      {myRole === 'host' && <option value="host">Host (Room Owner)</option>}
                      <option value="candidate">Candidate (Writing Code)</option>
                      <option value="interviewer">Interviewer (Reviewing)</option>
                      <option value="spectator">Observer (Silent Viewer)</option>
                    </select>
                    <UserCog
                      className="absolute right-3.5 top-3 text-zinc-500 pointer-events-none"
                      size={18}
                    />
                  </div>
                </div>

                <Button variant={isReady ? 'secondary' : 'primary'} onClick={toggleReady}>
                  {isReady ? (
                    <>Cancel Ready</>
                  ) : (
                    <>
                      <CheckCircle2 size={20} /> I'm Ready
                    </>
                  )}
                </Button>

                {/* 所有人准备完毕后出现的终极按钮 */}
                {allReady && (
                  <div className="pt-5 border-t border-zinc-800/80 animate-in fade-in zoom-in duration-500">
                    {/* 🎯 修复 1: 禁用的 Enter Workspace 按钮 */}
                    <button
                      type="button"
                      disabled={!isRoomValid}
                      className={`w-full font-bold py-3.5 px-6 rounded-xl transition-all duration-300 flex justify-center items-center gap-2.5 text-base tracking-wide ${
                        isRoomValid
                          ? 'bg-zinc-100 hover:bg-white text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-[0.98]'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                      }`}
                    >
                      <Play
                        size={18}
                        className={
                          isRoomValid
                            ? 'fill-zinc-950 text-zinc-950'
                            : 'fill-zinc-600 text-zinc-600'
                        }
                      />
                      Enter Workspace
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
