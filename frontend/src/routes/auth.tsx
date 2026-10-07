import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Loader2, Sparkles } from 'lucide-react';

export const Route = createFileRoute('/auth')({
  component: AuthComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      code: search.code as string | undefined,
      error: search.error as string | undefined,
      error_description: search.error_description as string | undefined,
    }
  }
});

type AuthMode = 'login' | 'signup_request' | 'signup_verify' | 'reset_request' | 'reset_verify' | 'set_password';

function AuthComponent() {
  const [mode, setMode] = useState<AuthMode>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // If already logged in and not in the process of setting a password, redirect to dashboard
  useEffect(() => {
    if (user && mode !== 'set_password') {
      navigate({ to: '/dashboard' });
    }
  }, [user, mode, navigate]);

  const handleGoogleLogin = async () => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError("Google Login setup: Please enter your real Supabase URL and Anon Key in frontend/.env (currently set to your-project-ref placeholder).");
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin + '/auth',
        }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Error initializing Google login');
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } 
      else if (mode === 'signup_request') {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        setMessage('OTP sent! Check your email to verify.');
        setMode('signup_verify');
      } 
      else if (mode === 'signup_verify') {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
        if (error) throw error;
        setMessage('Verification successful! Please set a password.');
        setPassword('');
        setMode('set_password');
      }
      else if (mode === 'reset_request') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage('Password reset OTP sent! Check your email.');
        setMode('reset_verify');
      }
      else if (mode === 'reset_verify') {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
        if (error) throw error;
        setMessage('Verification successful! Set your new password.');
        setPassword('');
        setMode('set_password');
      }
      else if (mode === 'set_password') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Password set successfully! Redirecting...');
        setTimeout(() => navigate({ to: '/dashboard' }), 1000);
      }
    } catch (err: any) {
      let friendlyError = err.message || 'An error occurred.';
      const rawMsg = friendlyError.toLowerCase();
      
      if (rawMsg.includes('rate limit')) {
        friendlyError = 'Please wait a moment before requesting another code.';
      } else if (rawMsg.includes('invalid login credentials') || rawMsg.includes('password')) {
        friendlyError = 'Invalid credentials. If you registered via Google, please use "Continue with Google".';
      } else if (rawMsg.includes('expired') || rawMsg.includes('invalid token') || rawMsg.includes('token has expired or is invalid')) {
        friendlyError = 'The verification code is invalid or has expired. Please request a new one.';
      } else if (rawMsg.includes('user not found')) {
        friendlyError = 'No account found with this email.';
      }
      
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  // Helper for rendering titles and button text based on mode
  const uiConfig = {
    login: { title: 'Welcome to PhantmOS', subtitle: 'Log in to find matching jobs.', btn: 'Log In' },
    signup_request: { title: 'Welcome to PhantmOS', subtitle: 'Create an account and start finding jobs.', btn: 'Create Account' },
    signup_verify: { title: 'Check your email', subtitle: 'Enter the 6-digit code sent to your email.', btn: 'Verify & Continue' },
    reset_request: { title: 'Reset your password', subtitle: 'Enter your email to receive a reset code.', btn: 'Send Reset Code' },
    reset_verify: { title: 'Check your email', subtitle: 'Enter the code sent to your email.', btn: 'Verify & Continue' },
    set_password: { title: 'Set new password', subtitle: 'Choose a password for your account.', btn: 'Save Password' }
  };

  const isOtpMode = mode === 'signup_verify' || mode === 'reset_verify';
  const isPasswordMode = mode === 'login' || mode === 'set_password';
  const isEmailMode = mode !== 'signup_verify' && mode !== 'reset_verify' && mode !== 'set_password';

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            {uiConfig[mode].title}
          </h2>
          <p className="mt-1.5 text-sm text-zinc-400">
            {uiConfig[mode].subtitle}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {message && (
          <div className="rounded-md bg-neon-green/15 p-3 text-sm text-neon-green border border-neon-green/30">
            {message}
          </div>
        )}


        {mode === 'login' && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or sign in with email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleAction} className="space-y-6">
          <div className="space-y-4">
            
            {isEmailMode && (
              <div>
                <label className="text-sm font-medium text-zinc-300">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 shadow-sm focus:border-white focus:outline-none"
                  placeholder="Example: you@domain.com"
                />
              </div>
            )}
            
            {isPasswordMode && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setMode('reset_request'); setError(null); setMessage(null); }} className="text-xs text-zinc-400 hover:text-white focus:outline-none">
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 shadow-sm focus:border-white focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            )}

            {isOtpMode && (
              <div>
                <label className="text-sm font-medium text-zinc-300">6-Digit Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-center font-mono text-2xl tracking-widest text-white shadow-sm focus:border-white focus:outline-none"
                  placeholder="000000"
                />
              </div>
            )}

          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
              </span>
            ) : uiConfig[mode].btn}
          </button>
        </form>

        {mode !== 'set_password' && (
          <div className="flex flex-col space-y-3 text-center text-sm pt-2 border-t border-zinc-900">
            {mode === 'login' ? (
              <button type="button" onClick={() => { setMode('signup_request'); setError(null); setMessage(null); }} className="text-zinc-300 hover:text-white focus:outline-none">
                Don't have an account? <span className="font-semibold underline">Create Account</span>
              </button>
            ) : (
              <button type="button" onClick={() => { setMode('login'); setError(null); setMessage(null); }} className="text-zinc-400 hover:text-white transition-colors focus:outline-none">
                ← Back to Log In
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
