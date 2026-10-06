-- =============================================================================
-- STRONGTIUM: SUPABASE POSTGRESQL SCHEMA & RLS MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- =============================================================================

-- Enable UUID extension if not enabled
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

-- 2. ROUTINES TABLE (Push, Pull, Legs, etc.)
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

-- 3. ROUTINE_EXERCISES TABLE (Exercises belonging to a routine)
CREATE TABLE IF NOT EXISTS public.routine_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    target_sets INT DEFAULT 3 NOT NULL,
    order_index INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. WORKOUT_SESSIONS TABLE (Completed & In-Progress sessions)
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

-- 6. LOGGED_SETS TABLE (Individual weight/reps)
CREATE TABLE IF NOT EXISTS public.logged_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logged_exercise_id UUID NOT NULL REFERENCES public.logged_exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    weight NUMERIC(6, 2) NOT NULL DEFAULT 0,
    reps INT NOT NULL DEFAULT 0,
    is_pr BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_exercises_user ON public.exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_user ON public.routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON public.routine_exercises(routine_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON public.workout_sessions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_logged_exercises_session ON public.logged_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_logged_sets_exercise ON public.logged_sets(logged_exercise_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each user only sees and modifies their own fitness data
-- =============================================================================
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logged_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logged_sets ENABLE ROW LEVEL SECURITY;

-- Exercises RLS
DROP POLICY IF EXISTS "Users manage own exercises" ON public.exercises;
CREATE POLICY "Users manage own exercises" ON public.exercises
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routines RLS
DROP POLICY IF EXISTS "Users manage own routines" ON public.routines;
CREATE POLICY "Users manage own routines" ON public.routines
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routine Exercises RLS (via routine ownership)
DROP POLICY IF EXISTS "Users manage own routine exercises" ON public.routine_exercises;
CREATE POLICY "Users manage own routine exercises" ON public.routine_exercises
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.routines r 
            WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.routines r 
            WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
        )
    );

-- Workout Sessions RLS
DROP POLICY IF EXISTS "Users manage own workout sessions" ON public.workout_sessions;
CREATE POLICY "Users manage own workout sessions" ON public.workout_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Logged Exercises RLS (via session ownership)
DROP POLICY IF EXISTS "Users manage own logged exercises" ON public.logged_exercises;
CREATE POLICY "Users manage own logged exercises" ON public.logged_exercises
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workout_sessions s 
            WHERE s.id = logged_exercises.session_id AND s.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workout_sessions s 
            WHERE s.id = logged_exercises.session_id AND s.user_id = auth.uid()
        )
    );

-- Logged Sets RLS (via logged exercise -> session ownership)
DROP POLICY IF EXISTS "Users manage own logged sets" ON public.logged_sets;
CREATE POLICY "Users manage own logged sets" ON public.logged_sets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.logged_exercises le
            JOIN public.workout_sessions s ON s.id = le.session_id
            WHERE le.id = logged_sets.logged_exercise_id AND s.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.logged_exercises le
            JOIN public.workout_sessions s ON s.id = le.session_id
            WHERE le.id = logged_sets.logged_exercise_id AND s.user_id = auth.uid()
        )
    );
