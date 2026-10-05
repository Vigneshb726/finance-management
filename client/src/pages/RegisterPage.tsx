import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Lock, Mail, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../layouts/AuthLayout';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { cn } from '../utils/cn';

const rules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains a letter', test: (p: string) => /[A-Za-z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (!rules.every((r) => r.test(form.password))) errs.password = 'Password does not meet the requirements';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setError('');
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err, 'Unable to create account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking your money in under a minute.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Full name" autoComplete="name" placeholder="Priya Patel" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} leftIcon={<User className="h-4 w-4" />} />
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} leftIcon={<Mail className="h-4 w-4" />} />
        <div>
          <Input label="Password" type="password" autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={(e) => set('password', e.target.value)} error={errors.password} leftIcon={<Lock className="h-4 w-4" />} />
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3">
            {rules.map((r) => {
              const ok = r.test(form.password);
              return (
                <li key={r.label} className={cn('flex items-center gap-1 text-xs', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                  <Check className="h-3 w-3" /> {r.label}
                </li>
              );
            })}
          </ul>
        </div>
        <Input label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} error={errors.confirm} leftIcon={<Lock className="h-4 w-4" />} />
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
