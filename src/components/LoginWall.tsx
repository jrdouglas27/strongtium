import React, { useState } from 'react';
import { Dumbbell, Mail, Lock, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginWall: React.FC = () => {
  const { signInWithEmail, signInWithOtp } = useAuth();

  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'magic') {
        const { error } = await signInWithOtp(email);
        if (error) throw error;
        setSuccessMessage('Magic link sent! Check your inbox to sign in.');
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2f4858] flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-[#8bb4cb] selection:text-[#0e2938]">
      <div className="max-w-md w-full bg-[#3d5a6c] border border-[#4e7085] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-[#f1f5f9]">
        {/* App Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] flex items-center justify-center mx-auto shadow-md">
            <Dumbbell className="w-7 h-7" />
          </div>

          <div className="flex items-center justify-center space-x-2 pt-1">
            <h1 className="text-2xl font-black text-white tracking-tight">STRONGTIUM</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#b9a1c6] text-[#2e1837] px-2 py-0.5 rounded border border-[#a48ab2]">
              TRACKER
            </span>
          </div>

          <p className="text-xs text-[#cbd5e1] font-medium">Personal Fitness & Progressive Overload</p>

          <div className="pt-1">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#2d4554] border border-[#3f5d70] text-[#8bb4cb] text-[11px] font-bold">
              <Lock className="w-3 h-3" />
              <span>Private Access Only</span>
            </span>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#cc8d8d] border border-[#b87676] text-[#3b1212] text-xs flex items-start space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#3b1212]" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-[#8fb89e] border border-[#78a387] text-[#0e2a18] text-xs flex items-start space-x-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0e2a18]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
              />
            </div>
          </div>

          {mode === 'password' && (
            <div>
              <label className="block text-xs font-bold text-white mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] border border-[#749fb7] font-extrabold py-3 rounded-xl text-xs transition disabled:opacity-50 shadow-md mt-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{mode === 'password' ? 'Sign In to Strongtium' : 'Send Magic Login Link'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Method Switcher */}
        <div className="pt-2 border-t border-[#4e7085] flex items-center justify-between text-xs text-[#cbd5e1]">
          {mode === 'password' ? (
            <button
              type="button"
              onClick={() => {
                setMode('magic');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-[#8bb4cb] hover:underline flex items-center space-x-1 font-semibold"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Use Magic Link instead</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-[#8bb4cb] hover:underline flex items-center space-x-1 font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Use Password instead</span>
            </button>
          )}

          <span className="text-[11px] text-[#94a3b8]">Personal User</span>
        </div>

        {/* Privacy Note */}
        <div className="bg-[#2d4554] border border-[#3f5d70] rounded-xl p-3 text-center">
          <p className="text-[11px] text-[#94a3b8] flex items-center justify-center space-x-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#8fb89e] shrink-0" />
            <span>Public registration is closed. All logs are encrypted and private.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
