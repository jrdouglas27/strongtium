import React, { useState } from 'react';
import { X, Mail, Lock, Sparkles, ArrowRight, CheckCircle2, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { signInWithEmail, signUpWithEmail, signInWithOtp, enableDemoMode } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'magic') {
        const { error } = await signInWithOtp(email);
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Magic login link sent! Check your inbox.',
        });
      } else if (mode === 'signup') {
        const { error } = await signUpWithEmail(email, password);
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Account created! Please verify your email or sign in.',
        });
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Authentication failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    enableDemoMode();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {mode === 'signin' && 'Welcome Back'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'magic' && 'Magic Link Sign In'}
            </h3>
            <p className="text-xs text-[#cbd5e1] mt-0.5 font-medium">
              Sync your workouts across iPhone & Laptop
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#2d4554] rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
              message.type === 'success'
                ? 'bg-[#8fb89e] border-[#78a387] text-[#0e2a18]'
                : 'bg-[#cc8d8d] border-[#b87676] text-[#3b1212]'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0e2a18]" />
            ) : (
              <Shield className="w-4 h-4 shrink-0 text-[#3b1212]" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-white mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
              />
            </div>
          </div>

          {mode !== 'magic' && (
            <div>
              <label className="block text-xs font-bold text-white mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#2d4554] border border-[#3f5d70] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#8bb4cb]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] border border-[#749fb7] font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50 mt-1 shadow-sm"
          >
            <span>{loading ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Alternate auth methods */}
        <div className="space-y-2 pt-2 border-t border-[#4e7085] text-center text-xs">
          {mode === 'signin' && (
            <div className="flex justify-between text-[#cbd5e1]">
              <button
                type="button"
                onClick={() => setMode('magic')}
                className="hover:text-white transition font-medium"
              >
                Sign in with Magic Link
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-[#8bb4cb] font-bold hover:underline"
              >
                Create Account
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <div className="text-[#cbd5e1]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-[#8bb4cb] font-bold hover:underline"
              >
                Sign In
              </button>
            </div>
          )}

          {mode === 'magic' && (
            <div className="text-[#cbd5e1]">
              Prefer password?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-[#8bb4cb] font-bold hover:underline"
              >
                Sign In with Password
              </button>
            </div>
          )}

          {/* Instant local preview button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleDemo}
              className="w-full flex items-center justify-center space-x-1.5 bg-[#c9bda9] hover:bg-[#b8a992] text-[#332919] border border-[#b3a58e] py-2 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Use Local Preview (No Account Needed)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
