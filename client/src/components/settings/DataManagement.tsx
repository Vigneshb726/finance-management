import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, FileDown, FolderOpen, HardDrive, Lock, Server, ShieldAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { desktopBridge, type DesktopInfo } from '../../platform/bridge';
import { pickTextFile, saveFile } from '../../platform/files';
import { getErrorMessage } from '../../services/api';
import { backendKind } from '../../services/backend';
import { authApi, backupApi, transactionsApi } from '../../services/endpoints';
import type { BackupFile } from '../../types';
import { decryptBackup, encryptBackup, isEncryptedBackup, type EncryptedBackup } from '../../utils/backupCrypto';
import { formatDate } from '../../utils/format';
import { Button } from '../ui/Button';
import { Input, Toggle } from '../ui/Field';
import { Modal } from '../ui/Modal';

function StorageInfo() {
  const kind = backendKind();
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  useEffect(() => {
    void desktopBridge()?.info().then(setInfo);
  }, []);

  if (kind === 'web') {
    return (
      <p className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Server className="mt-0.5 h-4 w-4 shrink-0" />
        Your data is stored in your Finora online account. Back it up to keep a copy or to move it into the desktop or mobile app.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
      <p className="flex gap-2">
        <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          Stored only on this {kind === 'desktop' ? 'computer' : 'device'} and works without an internet connection. Nothing is
          uploaded — back up regularly to keep a copy.
        </span>
      </p>
      <p className="flex gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {kind === 'mobile'
            ? 'The database is encrypted; its key is kept in the system keychain.'
            : info?.encrypted
              ? `The database is encrypted; its key is protected by ${info.keyProtection === 'basic_text' ? 'a local file' : 'the system keychain'}.`
              : 'Checking encryption…'}
        </span>
      </p>
      {info?.keyProtection === 'basic_text' && (
        <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          No system keyring was found, so the encryption key is only obfuscated. Install a keyring (e.g. GNOME Keyring or KWallet) for
          stronger protection.
        </p>
      )}
      {info && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <code className="max-w-full truncate rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800" title={info.dataPath}>
            {info.dataPath}
          </code>
          <Button variant="ghost" size="sm" onClick={() => void desktopBridge()?.showDataFolder()}>
            <FolderOpen className="h-3.5 w-3.5" /> Show folder
          </Button>
        </div>
      )}
    </div>
  );
}

export function DataManagement() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const [busy, setBusy] = useState<'csv' | 'backup' | 'restore' | null>(null);

  const [backupOpen, setBackupOpen] = useState(false);
  const [protect, setProtect] = useState(false);
  const [backupPassword, setBackupPassword] = useState({ password: '', confirm: '' });
  const [backupError, setBackupError] = useState('');

  const [pending, setPending] = useState<{ name: string; file: BackupFile | EncryptedBackup } | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreError, setRestoreError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const { filename, content } = await transactionsApi.exportCsv({ sortBy: 'date', sortOrder: 'asc' });
      const result = await saveFile({ filename, data: content, mimeType: 'text/csv', filter: { name: 'CSV file', extensions: ['csv'] } });
      if (result.status === 'saved') toast.success(result.location ? `Exported to ${result.location}` : 'CSV exported');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not export transactions'));
    } finally {
      setBusy(null);
    }
  };

  const createBackup = async () => {
    setBackupError('');
    if (protect) {
      if (backupPassword.password.length < 8) return setBackupError('Use a password of at least 8 characters');
      if (backupPassword.password !== backupPassword.confirm) return setBackupError('Passwords do not match');
    }
    setBusy('backup');
    try {
      const backup = await backupApi.create();
      const json = JSON.stringify(protect ? await encryptBackup(JSON.stringify(backup), backupPassword.password) : backup, null, 1);
      const result = await saveFile({
        filename: `finora-backup-${today}.json`,
        data: json,
        mimeType: 'application/json',
        filter: { name: 'Finora backup', extensions: ['json'] },
      });
      if (result.status !== 'cancelled') {
        toast.success(
          `Backup created · ${backup.transactions.length} transactions${protect ? ' · password protected' : ''}${result.status === 'saved' && 'location' in result && result.location ? ` · ${result.location}` : ''}`,
        );
        setBackupOpen(false);
        setBackupPassword({ password: '', confirm: '' });
      }
    } catch (err) {
      setBackupError(getErrorMessage(err, 'Could not create the backup'));
    } finally {
      setBusy(null);
    }
  };

  const chooseRestoreFile = async () => {
    try {
      const picked = await pickTextFile('.json,application/json');
      if (!picked) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(picked.text);
      } catch {
        return toast.error('That file is not a Finora backup (it is not valid JSON).');
      }
      if (!parsed || typeof parsed !== 'object' || (parsed as { app?: unknown }).app !== 'finora') {
        return toast.error('That file is not a Finora backup.');
      }
      setRestorePassword('');
      setRestoreError('');
      setPending({ name: picked.name, file: parsed as BackupFile | EncryptedBackup });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not read the file'));
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy('restore');
    setRestoreError('');
    try {
      const data = isEncryptedBackup(pending.file) ? await decryptBackup(pending.file, restorePassword) : pending.file;
      const counts = await backupApi.restore(data);
      // Profile settings (currency, theme, alerts) come from the backup too
      setUser(await authApi.me());
      await queryClient.invalidateQueries();
      toast.success(`Backup restored · ${counts.transactions} transactions, ${counts.budgets} budgets, ${counts.goals} goals`);
      setPending(null);
    } catch (err) {
      setRestoreError(getErrorMessage(err, 'Could not restore the backup'));
    } finally {
      setBusy(null);
    }
  };

  const plain = pending && !isEncryptedBackup(pending.file) ? (pending.file as BackupFile) : null;

  return (
    <div className="space-y-5">
      <StorageInfo />

      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" onClick={exportCsv} loading={busy === 'csv'}>
          {busy !== 'csv' && <FileDown className="h-4 w-4" />} Export CSV
        </Button>
        <Button variant="outline" onClick={() => setBackupOpen(true)}>
          <DatabaseBackup className="h-4 w-4" /> Create backup
        </Button>
        <Button variant="outline" onClick={chooseRestoreFile}>
          <Upload className="h-4 w-4" /> Restore backup
        </Button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Backups include transactions, recurring rules, categories, budgets, goals and preferences. A backup from any Finora app — web,
        desktop or mobile — can be restored into any other.
      </p>

      <Modal
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        title="Create backup"
        description="Saves all of your Finora data to a single file."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setBackupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createBackup} loading={busy === 'backup'}>
              Save backup
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Toggle
            label="Protect with a password"
            description="Encrypts the file (AES-256). Without the password it cannot be restored — Finora cannot recover it."
            checked={protect}
            onChange={setProtect}
          />
          {protect && (
            <div className="grid gap-3">
              <Input
                label="Backup password"
                type="password"
                autoComplete="new-password"
                value={backupPassword.password}
                onChange={(e) => setBackupPassword((p) => ({ ...p, password: e.target.value }))}
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={backupPassword.confirm}
                onChange={(e) => setBackupPassword((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
          )}
          {backupError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{backupError}</p>}
        </div>
      </Modal>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restore this backup?"
        description={pending?.name}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy === 'restore'}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={restore}
              loading={busy === 'restore'}
              disabled={!!pending && isEncryptedBackup(pending.file) && !restorePassword}
            >
              Replace my data
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            All current transactions, recurring rules, categories, budgets and goals will be replaced. Your name, email and password stay
            the same. Consider creating a backup first.
          </p>
          {plain && (
            <p>
              Made {formatDate(plain.exportedAt.slice(0, 10))} · {plain.transactions.length} transactions · {plain.budgets.length} budgets ·{' '}
              {plain.goals.length} goals
            </p>
          )}
          {pending && isEncryptedBackup(pending.file) && (
            <Input
              label="Backup password"
              type="password"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
              hint="This backup is password protected."
            />
          )}
          {restoreError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{restoreError}</p>}
        </div>
      </Modal>
    </div>
  );
}
