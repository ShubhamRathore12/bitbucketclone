import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { RegisterRequest, AuthResponse } from '@/types/auth';
import type { ApiError } from '@/types/common';

// ---------------------------------------------------------------------------
// OAuth buttons (shared with LoginPage – extract to components/auth later)
// ---------------------------------------------------------------------------

function OAuthButtons() {
  const providers = [
    { id: 'google', label: 'Google' },
    { id: 'github', label: 'GitHub' },
    { id: 'microsoft', label: 'Microsoft' },
  ] as const;

  const handleOAuth = (id: string) => {
    window.location.href = `/api/auth/oauth/${id}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => handleOAuth(p.id)}
          className="flex items-center justify-center gap-3 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
        >
          Continue with {p.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register API
// ---------------------------------------------------------------------------

async function registerApi(data: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// RegisterPage
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterRequest & { confirmPassword: string }>({
    username: '',
    email: '',
    password: '',
    displayName: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const registerMutation = useMutation<AuthResponse, ApiError, RegisterRequest>({
    mutationFn: registerApi,
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      navigate('/', { replace: true });
    },
    onError: (err) => {
      if (err.errors) {
        const mapped: Record<string, string> = {};
        err.errors.forEach((e) => {
          mapped[e.field] = e.message;
        });
        setFieldErrors(mapped);
      }
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.displayName.trim()) errors.displayName = 'Display name is required';
    if (!form.username.trim()) errors.username = 'Username is required';
    if (form.username.length < 3) errors.username = 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(form.username))
      errors.username = 'Username may only contain letters, numbers, hyphens, and underscores';
    if (!form.email.trim()) errors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email';
    if (!form.password) errors.password = 'Password is required';
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = 'Passwords do not match';
    if (!agreedToTerms) errors.terms = 'You must agree to the terms';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const { confirmPassword: _, ...payload } = form;
    registerMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex items-center gap-2 text-white mb-2">
            <svg viewBox="0 0 32 32" className="h-10 w-10" fill="currentColor" aria-hidden="true">
              <path d="M2 4a2 2 0 0 1 2-2h24a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm5 2.5 3.5 19h11L25 6.5H7z" />
            </svg>
            <span className="text-2xl font-bold tracking-tight">Bitbucket</span>
          </div>
          <p className="text-blue-200 text-sm">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">
          <OAuthButtons />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-800 px-3 text-gray-500 dark:text-gray-400">
                Or register with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {registerMutation.isError && !registerMutation.error?.errors?.length && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300" role="alert">
                {registerMutation.error?.message || 'Registration failed. Please try again.'}
              </div>
            )}

            <Input
              label="Display Name"
              name="displayName"
              autoComplete="name"
              placeholder="John Doe"
              value={form.displayName}
              onChange={handleChange}
              error={fieldErrors.displayName}
            />

            <Input
              label="Username"
              name="username"
              autoComplete="username"
              placeholder="johndoe"
              value={form.username}
              onChange={handleChange}
              error={fieldErrors.username}
              helperText="Letters, numbers, hyphens, and underscores only"
            />

            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              error={fieldErrors.email}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={handleChange}
              error={fieldErrors.password}
            />

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={form.confirmPassword}
              onChange={handleChange}
              error={fieldErrors.confirmPassword}
            />

            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.terms;
                    return next;
                  });
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" className="text-blue-600 hover:underline dark:text-blue-400">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
                  Privacy Policy
                </Link>
              </span>
            </label>
            {fieldErrors.terms && (
              <p className="text-sm text-red-600 dark:text-red-400 -mt-2">{fieldErrors.terms}</p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={registerMutation.isPending}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
