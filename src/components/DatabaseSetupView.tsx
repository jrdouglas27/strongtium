import React, { useState } from 'react';
import { Database, Copy, Check, ShieldCheck, Terminal } from 'lucide-react';

export const DatabaseSetupView: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const sqlMigration = `-- =============================================================================
-- STRONGTIUM: SUPABASE POSTGRESQL SCHEMA & RLS MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EXERCISES TABLE
CREATE TABLE IF NOT EXISTS public.exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_muscle_group TEXT DEFAULT 'General',
    default_unit TEXT DEFAULT 'kg' CHECK (default_unit IN ('kg', 'lbs')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ROUTINES TABLE
CREATE TABLE IF NOT EXISTS public.routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    target_rest_days INT DEFAULT 3 NOT NULL,
    last_completed_at TIMESTAMPTZ,
    order_index INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ROUTINE_EXERCISES TABLE
CREATE TABLE IF NOT EXISTS public.routine_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    target_sets INT DEFAULT 3 NOT NULL,
    order_index INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. WORKOUT_SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
    routine_name TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMPTZ,
    session_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. LOGGED_EXERCISES TABLE
CREATE TABLE IF NOT EXISTS public.logged_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
    exercise_name TEXT NOT NULL,
    exercise_notes TEXT,
    order_index INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. LOGGED_SETS TABLE
CREATE TABLE IF NOT EXISTS public.logged_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logged_exercise_id UUID NOT NULL REFERENCES public.logged_exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    weight NUMERIC(6, 2) NOT NULL DEFAULT 0,
    reps INT NOT NULL DEFAULT 0,
    is_pr BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logged_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logged_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own exercises" ON public.exercises;
CREATE POLICY "Users manage own exercises" ON public.exercises FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own routines" ON public.routines;
CREATE POLICY "Users manage own routines" ON public.routines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own routine exercises" ON public.routine_exercises;
CREATE POLICY "Users manage own routine exercises" ON public.routine_exercises FOR ALL USING (
    EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users manage own workout sessions" ON public.workout_sessions;
CREATE POLICY "Users manage own workout sessions" ON public.workout_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own logged exercises" ON public.logged_exercises;
CREATE POLICY "Users manage own logged exercises" ON public.logged_exercises FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = logged_exercises.session_id AND s.user_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.workout_sessions s WHERE s.id = logged_exercises.session_id AND s.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users manage own logged sets" ON public.logged_sets;
CREATE POLICY "Users manage own logged sets" ON public.logged_sets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.logged_exercises le JOIN public.workout_sessions s ON s.id = le.session_id WHERE le.id = logged_sets.logged_exercise_id AND s.user_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.logged_exercises le JOIN public.workout_sessions s ON s.id = le.session_id WHERE le.id = logged_sets.logged_exercise_id AND s.user_id = auth.uid())
);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlMigration);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
          <Database className="w-5 h-5 text-[#8bb4cb]" />
          <span>Supabase Database Setup</span>
        </h2>
        <p className="text-xs text-[#cbd5e1] font-medium">
          Run this SQL script in your Supabase project to create all tables and Row-Level Security policies.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
          <div className="text-[#8bb4cb] font-mono text-xs font-bold mb-1">STEP 1</div>
          <h4 className="text-sm font-bold text-white mb-1">Open SQL Editor</h4>
          <p className="text-xs text-[#cbd5e1] font-medium">
            Go to your Supabase Dashboard and click on <strong>SQL Editor</strong>.
          </p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
          <div className="text-[#8bb4cb] font-mono text-xs font-bold mb-1">STEP 2</div>
          <h4 className="text-sm font-bold text-white mb-1">Paste & Run</h4>
          <p className="text-xs text-[#cbd5e1] font-medium">
            Click <strong>New Query</strong>, paste the schema below, and click <strong>Run</strong>.
          </p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
          <div className="text-[#8fb89e] font-mono text-xs font-bold mb-1">STEP 3</div>
          <h4 className="text-sm font-bold text-white mb-1">Secure & Ready</h4>
          <p className="text-xs text-[#cbd5e1] font-medium">
            Your data is isolated with PostgreSQL RLS. You can sign in and log sets seamlessly!
          </p>
        </div>
      </div>

      {/* SQL Script Box */}
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-3.5 bg-[#2d4554] border-b border-[#3f5d70] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-[#94a3b8]" />
            <span className="text-xs font-mono font-bold text-[#f1f5f9]">schema.sql</span>
          </div>

          <button
            onClick={copyToClipboard}
            className="flex items-center space-x-1.5 bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] border border-[#749fb7] text-xs font-bold px-3 py-1.5 rounded-lg transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
          </button>
        </div>

        <pre className="p-4 text-[11px] font-mono text-[#f1f5f9] overflow-x-auto bg-[#2d4554] leading-relaxed max-h-96">
          {sqlMigration}
        </pre>
      </div>

      {/* RLS Security Note */}
      <div className="bg-[#8fb89e] border border-[#78a387] rounded-2xl p-4 flex items-start space-x-3 text-xs text-[#0e2a18]">
        <ShieldCheck className="w-5 h-5 text-[#0e2a18] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#0e2a18] font-bold block mb-0.5">
            Row Level Security (RLS) Guaranteed
          </strong>
          Every table enforces that workout sessions, routines, and performance notes are only accessible by your authenticated user ID.
        </div>
      </div>
    </div>
  );
};
