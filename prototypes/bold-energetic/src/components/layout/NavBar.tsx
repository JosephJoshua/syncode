import { Bell, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTheme } from '../../context/ThemeContext.tsx';
import { Badge } from '../ui/Badge.tsx';

const searchResults = [
  { label: 'Dashboard', to: '/dashboard', type: 'page' },
  { label: 'Session History', to: '/dashboard/history', type: 'page' },
  { label: 'Problem Browser', to: '/problems', type: 'page' },
  { label: 'Two Sum', to: '/problems/p1', type: 'problem' },
  { label: 'Binary Search', to: '/problems/p2', type: 'problem' },
  { label: 'Create Room', to: '/rooms/create', type: 'action' },
  { label: 'Join Room', to: '/rooms/join', type: 'action' },
  { label: 'Profile', to: '/profile', type: 'page' },
  { label: 'Admin Panel', to: '/admin', type: 'page' },
];

function typeBadgeVariant(type: string) {
  if (type === 'problem') return 'warning';
  if (type === 'action') return 'info';
  return 'neutral';
}

export function NavBar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const avatarRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
        setSearchQuery('');
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredResults = searchResults.filter((r) =>
    r.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const navLinkClass =
    'text-sm font-sans text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors';

  return (
    <>
      <nav className="sticky top-0 z-50 h-14 flex items-center justify-between px-4 md:px-6 bg-[var(--bg-card)] border-b border-[var(--border-default)] shadow-[var(--shadow-xs)]">
        {/* Left — Logo */}
        <Link to="/" className="font-display text-xl font-bold gradient-text">
          SynCode
        </Link>

        {/* Right — Nav items */}
        <div className="flex items-center gap-4">
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/dashboard" className={navLinkClass}>
              Dashboard
            </Link>
            <Link to="/rooms" className={navLinkClass}>
              Rooms
            </Link>
            <Link to="/problems" className={navLinkClass}>
              Problems
            </Link>

            <Link
              to="/rooms/create"
              className="gradient-brand text-white px-4 py-1.5 rounded-xl font-sans text-sm font-medium shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-glow-primary)] active:scale-[0.97] transition-all"
            >
              Create Room
            </Link>
          </div>

          {/* Search button */}
          <button
            type="button"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="Search"
            onClick={() => {
              setSearchOpen(true);
              setSearchQuery('');
            }}
          >
            <Search size={20} />
          </button>

          <button
            type="button"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} />
          </button>

          {/* Avatar dropdown */}
          <div className="relative" ref={avatarRef}>
            <button
              type="button"
              onClick={() => setAvatarOpen((prev) => !prev)}
              className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold select-none cursor-pointer"
              aria-label="User menu"
            >
              AD
            </button>

            {avatarOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-[var(--bg-card)] rounded-xl shadow-lg border border-[var(--border-default)] p-1 z-50">
                <Link
                  to="/profile"
                  onClick={() => setAvatarOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Profile
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setAvatarOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Settings
                </Link>
                <Link
                  to="/admin"
                  onClick={() => setAvatarOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Admin
                </Link>
                <div className="my-1 border-t border-[var(--border-default)]" />
                <Link
                  to="#"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-lg text-[var(--error)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <LogOut size={14} />
                  Log Out
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {/* Mobile hamburger */}
          <div className="relative md:hidden" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {mobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-card)] rounded-xl shadow-lg border border-[var(--border-default)] p-2 z-50">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/rooms"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Rooms
                </Link>
                <Link
                  to="/problems"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Problems
                </Link>
                <Link
                  to="/rooms/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg font-medium text-[var(--primary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Create Room
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/20 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
          onKeyDown={() => {}}
          role="presentation"
        >
          <div
            className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl shadow-xl p-4 border border-[var(--border-default)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={() => {}}
            role="dialog"
          >
            {/* Search input */}
            <div className="flex items-center gap-2 mb-3">
              <Search size={18} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pages, problems..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)] bg-[var(--bg-subtle)] rounded border border-[var(--border-default)]">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {filteredResults.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                  No results found
                </p>
              )}
              {filteredResults.map((result) => (
                <Link
                  key={result.to}
                  to={result.to}
                  onClick={() => {
                    setSearchOpen(false);
                    navigate(result.to);
                  }}
                  className="flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <span>{result.label}</span>
                  <Badge variant={typeBadgeVariant(result.type)}>{result.type}</Badge>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
