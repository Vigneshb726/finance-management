import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Database, KeyRound, Monitor, Moon, Palette, Sun, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { DataManagement } from '../components/settings/DataManagement';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Display';
import { Input, Select, Toggle } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { authApi } from '../services/endpoints';
import type { ThemePreference, User as UserT } from '../types';
import { cn } from '../utils/cn';
import { CURRENCIES } from '../utils/constants';
import { formatCurrency } from '../utils/format';

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="grid gap-6 p-6 md:grid-cols-3">
      <div>
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          {icon}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="md:col-span-2">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email });
  }, [user]);

  if (!user) return null;

  /** Saves a preference immediately and refreshes currency-formatted views. */
  const savePreference = async (patch: Partial<UserT>, message = 'Preferences saved') => {
    try {
      const updated = await authApi.updateProfile(patch);
      setUser(updated);
      if (patch.currency) queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});
    try {
      setUser(await authApi.updateProfile({ name: profile.name.trim(), email: profile.email.trim() }));
      toast.success('Profile updated');
    } catch (err) {
      setProfileErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (passwords.newPassword !== passwords.confirm) return setPwError('New passwords do not match');
    if (passwords.newPassword.length < 8 || !/[A-Za-z]/.test(passwords.newPassword) || !/\d/.test(passwords.newPassword))
      return setPwError('New password must be at least 8 characters and include a letter and a number');
    setSavingPw(true);
    try {
      await authApi.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) {
      setPwError(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await authApi.deleteAccount(deletePassword);
      logout();
      toast.success('Your account has been deleted');
      navigate('/register', { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'LIGHT', label: 'Light', icon: Sun },
    { value: 'DARK', label: 'Dark', icon: Moon },
    { value: 'SYSTEM', label: 'System', icon: Monitor },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, preferences and account security." />
      <div className="space-y-4">
        <Section icon={<User className="h-4 w-4" />} title="Profile" description="Your name and sign-in email.">
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} error={profileErrors.name} />
              <Input label="Email" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} error={profileErrors.email} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile} disabled={profile.name === user.name && profile.email === user.email}>
                Save profile
              </Button>
            </div>
          </form>
        </Section>

        <Section icon={<Palette className="h-4 w-4" />} title="Preferences" description="Currency and appearance.">
          <div className="space-y-5">
            <Select
              label="Currency"
              value={user.currency}
              onChange={(e) => savePreference({ currency: e.target.value }, 'Currency updated')}
              hint={`Amounts are displayed like ${formatCurrency(123456.5, user.currency)}. Changing currency does not convert existing amounts.`}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
            <div>
              <span className="label">Theme</span>
              <div className="grid grid-cols-3 gap-2">
                {themes.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={theme === value}
                    onClick={() => {
                      setTheme(value);
                      savePreference({ theme: value }, 'Theme updated');
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition',
                      theme === value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10 dark:bg-brand-500/10 dark:text-brand-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section icon={<Bell className="h-4 w-4" />} title="Notifications" description="Choose which alerts you receive.">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <Toggle
              label="Budget alerts"
              description="When spending reaches 80% of a budget and when a budget is exceeded."
              checked={user.notifyBudgetAlerts}
              onChange={(v) => savePreference({ notifyBudgetAlerts: v })}
            />
            <Toggle
              label="Savings goal milestones"
              description="When a goal reaches 25%, 50%, 75% and 100%."
              checked={user.notifyGoalMilestones}
              onChange={(v) => savePreference({ notifyGoalMilestones: v })}
            />
            <Toggle
              label="Monthly summary"
              description="A recap of last month's income, expenses and savings."
              checked={user.notifyMonthlySummary}
              onChange={(v) => savePreference({ notifyMonthlySummary: v })}
            />
          </div>
        </Section>

        <Section icon={<Database className="h-4 w-4" />} title="Data & backup" description="Export transactions, back up everything, or restore from a backup file.">
          <DataManagement />
        </Section>

        <Section icon={<KeyRound className="h-4 w-4" />} title="Change password" description="Use at least 8 characters with a letter and a number.">
          <form onSubmit={changePassword} className="space-y-4">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
            {pwError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{pwError}</p>}
            <div className="flex justify-end">
              <Button type="submit" loading={savingPw} disabled={!passwords.currentPassword || !passwords.newPassword}>
                Update password
              </Button>
            </div>
          </form>
        </Section>

        <Section icon={<Trash2 className="h-4 w-4 text-red-600" />} title="Account" description="Permanently delete your account and all data.">
          <div className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-500/20 dark:bg-red-500/5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Delete account</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">All transactions, budgets, goals and categories will be erased. This cannot be undone.</p>
            </div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        </Section>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description="This permanently erases all of your data."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} disabled={!deletePassword} onClick={deleteAccount}>
              Delete permanently
            </Button>
          </>
        }
      >
        <Input label="Confirm with your password" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} error={deleteError} />
      </Modal>
    </>
  );
}
