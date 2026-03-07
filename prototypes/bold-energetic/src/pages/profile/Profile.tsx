import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { ProgressRing } from '../../components/ui/ProgressRing.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Toggle } from '../../components/ui/Toggle.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { toast } from '../../lib/toast.ts';

export function Profile() {
  const { theme, toggleTheme } = useTheme();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [emailSummaries, setEmailSummaries] = useState(true);
  const [weeklyReminders, setWeeklyReminders] = useState(false);
  const [featureAnnouncements, setFeatureAnnouncements] = useState(true);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header Card */}
      <Card>
        <div className="flex items-center gap-5">
          <Avatar size="xl" name="Alice Doe" />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              Alice Doe
            </h1>
            <p className="text-[var(--text-secondary)] text-sm">alice@syncode.dev</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Joined March 2026</p>
          </div>
          <Button variant="secondary">Edit Profile</Button>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Sessions</p>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">10</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Problems Solved</p>
          <p className="font-display text-3xl font-bold text-[var(--text-primary)]">23</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Avg Score</p>
          <ProgressRing value={85} size={52} strokeWidth={4} />
        </Card>
        <Card className="text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Practice Time</p>
          <p className="font-display text-3xl font-bold gradient-text">12.5h</p>
        </Card>
      </div>

      {/* Account Settings */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-4">
          Account Settings
        </h2>
        <div className="space-y-4">
          <Input label="Full Name" defaultValue="Alice Doe" />
          <Input label="Email" defaultValue="alice@syncode.dev" />

          {/* Change Password */}
          <div>
            <button
              type="button"
              onClick={() => setShowChangePassword((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline cursor-pointer"
            >
              Change Password
              {showChangePassword ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showChangePassword && (
              <div className="mt-3 space-y-3">
                <Input label="Current Password" type="password" />
                <Input label="New Password" type="password" />
                <Input label="Confirm Password" type="password" />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-4">
          Preferences
        </h2>
        <div className="space-y-5">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-primary)]">Dark Mode</span>
            <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
          </div>

          {/* Default Language */}
          <Select label="Default Language" defaultValue="javascript">
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
          </Select>

          {/* Editor Font Size */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Editor Font Size: {fontSize}px
            </label>
            <input
              type="range"
              min={12}
              max={24}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-[var(--primary)] cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-4">
          Notifications
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-primary)]">Email session summaries</span>
            <Toggle checked={emailSummaries} onChange={setEmailSummaries} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-primary)]">Weekly practice reminders</span>
            <Toggle checked={weeklyReminders} onChange={setWeeklyReminders} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-primary)]">New feature announcements</span>
            <Toggle checked={featureAnnouncements} onChange={setFeatureAnnouncements} />
          </div>
        </div>
      </Card>

      {/* Bottom Buttons */}
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => toast.success('Settings saved!')}>
          Save Changes
        </Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </div>
  );
}
