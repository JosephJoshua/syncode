import { FileText, Menu, Moon, Search, Settings, Sun, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTheme } from '../../context/ThemeContext';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/problems', label: 'Problems' },
];

const searchResults = [
  { icon: FileText, label: 'Two Sum', type: 'Problem', to: '/problems/p1' },
  { icon: FileText, label: 'Binary Search', type: 'Problem', to: '/problems/p2' },
  { icon: Users, label: 'Room: Algorithm Practice', type: 'Room', to: '/rooms' },
  { icon: Settings, label: 'Settings', type: 'Page', to: '/profile/settings' },
  { icon: Users, label: 'Alice Chen', type: 'User', to: '/profile' },
];

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function isNavActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-[var(--border-default)] bg-[var(--bg-base)]/95 backdrop-blur-sm">
      <div className="flex h-full items-center px-4 md:px-6">
        {/* Left section */}
        <div className="flex items-center gap-1">
          <Link
            to="/dashboard"
            className="mr-4 font-display text-lg font-bold tracking-tight text-[var(--text-primary)]"
          >
            <span className="text-[var(--accent)]">Syn</span>Code
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-100 ${
                  isNavActive(link.to)
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Cmd+K search trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-tertiary)] hover:border-[var(--border-strong)] transition-colors duration-100 cursor-pointer"
          >
            <Search size={14} />
            <span className="font-mono text-[11px]">search...</span>
            <kbd className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
              ⌘K
            </kbd>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors duration-100"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User avatar */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-muted)] text-xs font-mono font-medium text-[var(--accent)] cursor-pointer"
            >
              AC
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-md shadow-xl min-w-[160px] py-1">
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer block w-full text-left"
                >
                  Profile
                </Link>
                <Link
                  to="/profile/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer block w-full text-left"
                >
                  Settings
                </Link>
                <Link
                  to="/admin"
                  onClick={() => setDropdownOpen(false)}
                  className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer block w-full text-left"
                >
                  Admin
                </Link>
                <div className="h-px bg-[var(--border-default)] my-1" />
                <Link
                  to="/login"
                  onClick={() => setDropdownOpen(false)}
                  className="px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--bg-subtle)] hover:text-[var(--error)] transition-colors cursor-pointer block w-full text-left"
                >
                  Log Out
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors duration-100"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden absolute top-12 left-0 right-0 border-b border-[var(--border-default)] bg-[var(--bg-overlay)] shadow-[var(--shadow-md)]">
          <nav className="flex flex-col p-2 gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`rounded-md px-3 py-2 text-sm transition-colors duration-100 ${
                  isNavActive(link.to)
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
      {/* Cmd+K Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-center bg-[var(--bg-base)]/60 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg shadow-xl max-w-lg w-full mx-4 mt-[15vh] h-fit animate-[modal-slide-up_200ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="border-b border-[var(--border-default)] px-4 py-3 flex items-center gap-3">
              <Search size={18} className="text-[var(--text-tertiary)] flex-none" />
              <input
                type="text"
                placeholder="Search..."
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
              />
              <kbd className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
                ESC
              </kbd>
            </div>

            {/* Search results */}
            <div className="py-2">
              {searchResults
                .filter((result) => result.label.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((result) => (
                  <Link
                    key={result.label}
                    to={result.to}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center w-full py-2 px-4 hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors duration-100"
                  >
                    <result.icon size={16} className="text-[var(--text-tertiary)] mr-3 flex-none" />
                    <span className="text-sm text-[var(--text-primary)]">{result.label}</span>
                    <span className="ml-auto font-mono text-xs text-[var(--text-tertiary)]">
                      {result.type}
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
