import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useTheme } from '../../context/ThemeContext';
import { toast } from '../../lib/toast';

export function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [notifications, setNotifications] = useState({
    sessionReminders: true,
    aiReviewResults: true,
    platformUpdates: false,
  });

  function toggleNotification(key: keyof typeof notifications) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div>
      {/* Back link */}
      <Link to="/profile" className="font-mono text-xs text-[var(--accent)] hover:underline">
        &larr; profile
      </Link>

      {/* Header */}
      <p className="font-mono text-xs tracking-widest uppercase text-[var(--accent)] mt-3">
        {'// settings'}
      </p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-2">
        Settings
      </h1>

      {/* Account Section */}
      <Card padding="p-5" className="mt-4">
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">Account</h2>
        <div className="mt-4">
          <Input label="Full Name" defaultValue="Alice Chen" />
        </div>
        <div className="mt-3">
          <Input label="Email" type="email" defaultValue="alice@example.com" />
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Change Password
            {showPassword ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showPassword && (
            <div className="mt-3 space-y-3">
              <Input
                label="Current Password"
                type="password"
                placeholder="Enter current password"
              />
              <Input label="New Password" type="password" placeholder="Enter new password" />
              <Input label="Confirm Password" type="password" placeholder="Confirm new password" />
            </div>
          )}
        </div>
      </Card>

      {/* Preferences Section */}
      <Card padding="p-5" className="mt-4">
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Preferences
        </h2>

        {/* Theme Toggle */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Theme
          </label>
          <div className="inline-flex rounded-md border border-[var(--border-default)] overflow-hidden">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[var(--accent)] text-[#09090b]'
                  : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-[var(--accent)] text-[#09090b]'
                  : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              Light
            </button>
          </div>
        </div>

        {/* Default Language */}
        <div className="mt-4">
          <Select label="Default Language" defaultValue="javascript">
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </Select>
        </div>

        {/* Editor Font Size */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Editor Font Size
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={12}
              max={20}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 accent-[var(--accent)] cursor-pointer"
            />
            <span className="font-mono text-sm text-[var(--text-primary)] min-w-[40px] text-right">
              {fontSize}px
            </span>
          </div>
        </div>
      </Card>

      {/* Notifications Section */}
      <Card padding="p-5" className="mt-4">
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Notifications
        </h2>

        <div className="mt-4 space-y-4">
          <ToggleRow
            label="Session reminders"
            checked={notifications.sessionReminders}
            onChange={() => toggleNotification('sessionReminders')}
          />
          <ToggleRow
            label="AI review results"
            checked={notifications.aiReviewResults}
            onChange={() => toggleNotification('aiReviewResults')}
          />
          <ToggleRow
            label="Platform updates"
            checked={notifications.platformUpdates}
            onChange={() => toggleNotification('platformUpdates')}
          />
        </div>
      </Card>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={() => toast.success('Settings saved!')}>
          Save Changes
        </Button>
        <Button variant="ghost" onClick={() => navigate('/profile')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)] ${
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-subtle)]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
