import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Flame,
  Dumbbell,
  LineChart as LineChartIcon,
  History as HistoryIcon,
  Layers,
  TrendingUp,
  Award,
  Calendar,
  Zap,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Activity,
  BarChart3,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { useAuth } from '../context/AuthContext';
import { TabType } from './Navbar';
import {
  calculate1RM,
  formatDate,
  formatRelativeDays,
  calculateMovementDueStatus,
  getBaseExerciseName,
  getTimeDomain,
  getWeightYDomain,
} from '../lib/calculations';
import { ConsistencyHeatmap } from './ConsistencyHeatmap';

interface HomeDashboardProps {
  onNavigate: (tab: TabType) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { routines, sessions, personalRecords, loadStarterRoutines } = useWorkout();

  // User display name from metadata or email
  const userGreeting = useMemo(() => {
    if (!user) return 'Athlete';
    if (user.user_metadata?.full_name) return user.user_metadata.full_name.split(' ')[0];
    if (user.email) return user.email.split('@')[0];
    return 'Athlete';
  }, [user]);

  // Compute 3-day repeat cadence across individual movements (rather than muscle group splits)
  const movementStatuses = useMemo(() => {
    const names = new Map<string, string>();
    const lastDates = new Map<string, string>();

    routines.forEach((r) => {
      (r.exercises || []).forEach((re) => {
        const base = getBaseExerciseName(re.exercise?.name || '');
        if (base) names.set(base.toLowerCase(), base);
      });
    });

    sessions.forEach((s) => {
      const sDate = s.completed_at || s.started_at;
      s.logged_exercises?.forEach((le) => {
        const base = getBaseExerciseName(le.exercise_name);
        if (base && le.sets?.length > 0) {
          const key = base.toLowerCase();
          if (!names.has(key)) names.set(key, base);
          if (sDate) {
            const prev = lastDates.get(key);
            if (!prev || new Date(sDate).getTime() > new Date(prev).getTime()) {
              lastDates.set(key, sDate);
            }
          }
        }
      });
    });

    const list = Array.from(names.entries()).map(([key, name]) => {
      const lastDate = lastDates.get(key) || null;
      const status = calculateMovementDueStatus(lastDate, 3);
      return { name, status };
    });

    list.sort((a, b) => {
      const aIsDue = a.status.status === 'due' ? 0 : a.status.status === 'upcoming' ? 1 : 2;
      const bIsDue = b.status.status === 'due' ? 0 : b.status.status === 'upcoming' ? 1 : 2;
      if (aIsDue !== bIsDue) return aIsDue - bIsDue;
      if (a.status.status === 'due' && b.status.status === 'due') {
        return (b.status.daysSinceLast || 0) - (a.status.daysSinceLast || 0);
      }
      if (a.status.status === 'upcoming' && b.status.status === 'upcoming') {
        return (a.status.daysUntilDue || 99) - (b.status.daysUntilDue || 99);
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [routines, sessions]);

  const overdueOrDueMovements = useMemo(() => {
    return movementStatuses.filter((m) => m.status.status === 'due');
  }, [movementStatuses]);

  // High-Level Momentum Stats (Past 7 Days, Past 30 Days)
  const stats = useMemo(() => {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(now.getTime() - 7 * msPerDay);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * msPerDay);

    const completedSessions = sessions.filter((s) => s.completed_at);

    let past7DaysWorkouts = 0;
    let past7DaysVolume = 0;
    let past7DaysSets = 0;

    let past30DaysWorkouts = 0;
    let past30DaysVolume = 0;
    let totalVolumeAllTime = 0;

    completedSessions.forEach((s) => {
      const sDate = new Date(s.completed_at!);
      let sVol = 0;
      let sSets = 0;

      s.logged_exercises?.forEach((le) => {
        le.sets?.forEach((st) => {
          const w = Number(st.weight) || 0;
          const r = Number(st.reps) || 0;
          sVol += w * r;
          sSets += 1;
        });
      });

      totalVolumeAllTime += sVol;

      if (sDate >= sevenDaysAgo) {
        past7DaysWorkouts += 1;
        past7DaysVolume += sVol;
        past7DaysSets += sSets;
      }
      if (sDate >= thirtyDaysAgo) {
        past30DaysWorkouts += 1;
        past30DaysVolume += sVol;
      }
    });

    return {
      totalWorkouts: completedSessions.length,
      past7DaysWorkouts,
      past7DaysVolume,
      past7DaysSets,
      past30DaysWorkouts,
      past30DaysVolume,
      totalVolumeAllTime,
    };
  }, [sessions]);

  // Graph Toggle State: 'weekly' or 'dayOfWeek'
  const [frequencyView, setFrequencyView] = useState<'weekly' | 'dayOfWeek'>('weekly');

  // Weekly Workout Frequency (Past 8 Weeks)
  const weeklyFrequencyData = useMemo(() => {
    const weeks: {
      weekLabel: string;
      startDate: Date;
      endDate: Date;
      workouts: number;
      volume: number;
      sets: number;
    }[] = [];

    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = (currentDay + 6) % 7;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);

    for (let i = 7; i >= 0; i--) {
      const startOfWeek = new Date(thisMonday);
      startOfWeek.setDate(startOfWeek.getDate() - i * 7);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      let label: string;
      if (i === 0) {
        label = 'This Wk';
      } else if (i === 1) {
        label = 'Last Wk';
      } else {
        label = startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }

      weeks.push({
        weekLabel: label,
        startDate: startOfWeek,
        endDate: endOfWeek,
        workouts: 0,
        volume: 0,
        sets: 0,
      });
    }

    sessions.forEach((s) => {
      if (!s.completed_at) return;
      const d = new Date(s.completed_at);
      const matchingWeek = weeks.find((w) => d >= w.startDate && d <= w.endDate);
      if (matchingWeek) {
        matchingWeek.workouts += 1;
        s.logged_exercises?.forEach((le) => {
          le.sets?.forEach((st) => {
            const w = Number(st.weight) || 0;
            const r = Number(st.reps) || 0;
            matchingWeek.volume += w * r;
            matchingWeek.sets += 1;
          });
        });
      }
    });

    return weeks.map((w) => ({
      week: w.weekLabel,
      workouts: w.workouts,
      volume: Math.round(w.volume),
      sets: w.sets,
    }));
  }, [sessions]);

  // Average workouts per week over the 8 weeks
  const avgWorkoutsPerWeek = useMemo(() => {
    const total = weeklyFrequencyData.reduce((acc, w) => acc + w.workouts, 0);
    return Math.round((total / (weeklyFrequencyData.length || 1)) * 10) / 10;
  }, [weeklyFrequencyData]);

  // Day-of-Week Distribution (Which days do you train most?)
  const dayOfWeekDistribution = useMemo(() => {
    const days = [
      { day: 'Mon', count: 0, volume: 0 },
      { day: 'Tue', count: 0, volume: 0 },
      { day: 'Wed', count: 0, volume: 0 },
      { day: 'Thu', count: 0, volume: 0 },
      { day: 'Fri', count: 0, volume: 0 },
      { day: 'Sat', count: 0, volume: 0 },
      { day: 'Sun', count: 0, volume: 0 },
    ];

    sessions.forEach((s) => {
      if (!s.completed_at) return;
      const d = new Date(s.completed_at);
      const dayIdx = (d.getDay() + 6) % 7;
      days[dayIdx].count += 1;
      s.logged_exercises?.forEach((le) => {
        le.sets?.forEach((st) => {
          days[dayIdx].volume += (Number(st.weight) || 0) * (Number(st.reps) || 0);
        });
      });
    });

    return days;
  }, [sessions]);

  // Exercise Spotlight for Simplified Analytics
  const exercisesWithData = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      s.logged_exercises?.forEach((le) => {
        const name = le.exercise_name?.trim();
        if (name && le.sets?.length > 0) {
          map.set(name, (map.get(name) || 0) + le.sets.length);
        }
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [sessions]);

  const [spotlightExercise, setSpotlightExercise] = useState<string>('');

  React.useEffect(() => {
    if (exercisesWithData.length > 0 && (!spotlightExercise || !exercisesWithData.includes(spotlightExercise))) {
      setSpotlightExercise(exercisesWithData[0]);
    }
  }, [exercisesWithData, spotlightExercise]);

  const spotlightChartData = useMemo(() => {
    if (!spotlightExercise) return [];
    const points: {
      timestamp: number;
      date: string;
      maxWeight: number;
      estimated1RM: number;
    }[] = [];
    const sorted = [...sessions]
      .filter((s) => s.completed_at || s.started_at)
      .sort(
        (a, b) =>
          new Date(a.completed_at || a.started_at!).getTime() -
          new Date(b.completed_at || b.started_at!).getTime()
      );

    sorted.forEach((s) => {
      const dateStr = s.completed_at || s.started_at;
      if (!dateStr) return;
      const ex = s.logged_exercises?.find(
        (le) => le.exercise_name.trim().toLowerCase() === spotlightExercise.trim().toLowerCase()
      );
      if (ex && ex.sets.length > 0) {
        let maxW = 0;
        let best1RM = 0;
        ex.sets.forEach((st) => {
          const w = Number(st.weight) || 0;
          const r = Number(st.reps) || 0;
          if (w > maxW) maxW = w;
          const est = calculate1RM(w, r);
          if (est > best1RM) best1RM = est;
        });

        const d = new Date(dateStr);
        points.push({
          timestamp: d.getTime(),
          date: d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
          maxWeight: maxW,
          estimated1RM: best1RM,
        });
      }
    });
    return points;
  }, [sessions, spotlightExercise]);

  const spotlightTimeDomain = useMemo(() => {
    return getTimeDomain(spotlightChartData.map((p) => p.timestamp));
  }, [spotlightChartData]);

  const spotlightYDomain = useMemo(() => {
    return getWeightYDomain(
      spotlightChartData.flatMap((p) => [p.estimated1RM, p.maxWeight])
    );
  }, [spotlightChartData]);

  // Recent PR Trophies
  const recentPRs = useMemo(() => {
    return Object.values(personalRecords)
      .sort((a, b) => new Date(b.achieved_at || 0).getTime() - new Date(a.achieved_at || 0).getTime())
      .slice(0, 3);
  }, [personalRecords]);

  // Last Completed Session
  const lastSession = useMemo(() => {
    const completed = sessions.filter((s) => s.completed_at);
    return completed[0] || null;
  }, [sessions]);

  const lastSessionStats = useMemo(() => {
    if (!lastSession) return null;
    const sets = (lastSession.logged_exercises || []).reduce((acc, ex) => acc + ex.sets.length, 0);

    // Group logged exercises by base movement name so unilateral L/R and multi-group logs are summarized cleanly
    const movementMap = new Map<string, { name: string; setsCount: number; maxWeight: number }>();
    (lastSession.logged_exercises || []).forEach((ex) => {
      const baseName = getBaseExerciseName(ex.exercise_name);
      if (!baseName) return;
      const key = baseName.toLowerCase();
      const existing = movementMap.get(key) || { name: baseName, setsCount: 0, maxWeight: 0 };
      existing.setsCount += ex.sets?.length || 0;
      ex.sets?.forEach((s) => {
        const w = Number(s.weight) || 0;
        if (w > existing.maxWeight) existing.maxWeight = w;
      });
      movementMap.set(key, existing);
    });

    const movements = Array.from(movementMap.values());
    return {
      setsCount: sets,
      exercisesCount: movements.length,
      movements,
    };
  }, [lastSession]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Welcome & Next Up Card */}
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-3xl p-5 sm:p-7 shadow-sm text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-[#2d4554] border border-[#3f5d70] px-3 py-1 rounded-full text-xs font-mono text-[#8bb4cb]">
              <Sparkles className="w-3.5 h-3.5 text-[#8bb4cb]" />
              <span>STRONGBOARD OVERVIEW</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {userGreeting}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#cbd5e1] max-w-xl font-medium">
              {overdueOrDueMovements.length > 0 ? (
                <>
                  You have{' '}
                  <strong className="text-white underline decoration-[#8bb4cb] decoration-2">
                    {overdueOrDueMovements.length} movement{overdueOrDueMovements.length === 1 ? '' : 's'}
                  </strong>{' '}
                  due or overdue on your 3-day repeat cycle (including{' '}
                  <strong className="text-white">{overdueOrDueMovements[0].name}</strong>).
                </>
              ) : (
                'Track your compound lifts, master your movements, and let the 3-day movement repeat cycle guide your momentum.'
              )}
            </p>
          </div>

          {/* Quick Action Button to Workouts */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('workouts')}
              className="flex items-center space-x-2 bg-[#8bb4cb] hover:bg-[#749fb7] text-[#0e2938] px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <Dumbbell className="w-4 h-4" />
              <span>Log Workout Now</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Movement Repeat Cadence Status Chips Bar */}
        {movementStatuses.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#4e7085]/70">
            <div className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-[#8bb4cb]" />
              <span>Movement Repeat Cadence (Every 3 Days)</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {movementStatuses.slice(0, 10).map(({ name, status }) => {
                const isOverdue = status.status === 'due' && status.badgeColor === 'red';
                const isDueToday = status.status === 'due' && status.badgeColor !== 'red';
                return (
                  <button
                    key={name}
                    onClick={() => onNavigate('workouts')}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                      isOverdue
                        ? 'bg-[#cc8d8d]/25 text-[#ffd6d6] border-[#cc8d8d]/60 shadow-sm'
                        : isDueToday
                        ? 'bg-[#274a38] text-[#8fb89e] border-[#3c6e54] shadow-sm'
                        : 'bg-[#2d4554] text-[#cbd5e1] border-[#3f5d70] hover:text-white'
                    }`}
                  >
                    {isOverdue || isDueToday ? (
                      <Flame className={`w-3.5 h-3.5 ${isOverdue ? 'text-[#ffd6d6]' : 'text-[#8fb89e]'}`} />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#8bb4cb]" />
                    )}
                    <span>{name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isOverdue
                          ? 'bg-[#3b1212]/60 text-[#ffd6d6]'
                          : isDueToday
                          ? 'bg-[#1f3a2c] text-white'
                          : 'bg-[#3d5a6c] text-[#94a3b8]'
                      }`}
                    >
                      {status.badgeText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4 Summary Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[#8bb4cb] text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <Activity className="w-4 h-4" />
              <span>Workouts (7d)</span>
            </span>
            <span className="text-[10px] bg-[#2d4554] px-1.5 py-0.5 rounded text-[#cbd5e1] font-mono">
              Past 7 Days
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {stats.past7DaysWorkouts}
            <span className="text-xs font-sans text-[#cbd5e1] font-normal ml-1">sessions</span>
          </p>
          <p className="text-[11px] text-[#cbd5e1] font-medium">
            {stats.totalWorkouts} all-time completed
          </p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[#8fb89e] text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <Zap className="w-4 h-4" />
              <span>Sets (7d)</span>
            </span>
            <span className="text-[10px] bg-[#2d4554] px-1.5 py-0.5 rounded text-[#cbd5e1] font-mono">
              Past 7 Days
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {stats.past7DaysSets}
            <span className="text-xs font-sans text-[#cbd5e1] font-normal ml-1">sets</span>
          </p>
          <p className="text-[11px] text-[#cbd5e1] font-medium">
            Across {stats.past7DaysWorkouts} workouts completed
          </p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[#cc8d8d] text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <Award className="w-4 h-4" />
              <span>PR Breakthroughs</span>
            </span>
            <span className="text-[10px] bg-[#2d4554] px-1.5 py-0.5 rounded text-[#cbd5e1] font-mono">
              Trophies
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {Object.keys(personalRecords).length}
            <span className="text-xs font-sans text-[#cbd5e1] font-normal ml-1">records</span>
          </p>
          <p className="text-[11px] text-[#cbd5e1] font-medium">
            Peak performance milestones
          </p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[#b9a1c6] text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4" />
              <span>Consistency (30d)</span>
            </span>
            <span className="text-[10px] bg-[#2d4554] px-1.5 py-0.5 rounded text-[#cbd5e1] font-mono">
              Past Month
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {stats.past30DaysWorkouts}
            <span className="text-xs font-sans text-[#cbd5e1] font-normal ml-1">active days</span>
          </p>
          <p className="text-[11px] text-[#cbd5e1] font-medium">
            Avg {avgWorkoutsPerWeek} sessions / week
          </p>
        </div>
      </div>

      {/* Main Graphs Grid: Frequency Chart & Lift Spotlight (Side by Side 50/50, deeper charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Workout Frequency Chart (6 cols on large) */}
        <div className="lg:col-span-6 bg-[#3d5a6c] border border-[#4e7085] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-[#8bb4cb]" />
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Workout Frequency & Rhythm
                </h3>
              </div>
              <p className="text-xs text-[#cbd5e1] font-medium">
                {frequencyView === 'weekly'
                  ? `Weekly workouts logged over the past 8 weeks (avg ${avgWorkoutsPerWeek}/wk)`
                  : 'Distribution of sessions across days of the week'}
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center bg-[#2d4554] border border-[#3f5d70] p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFrequencyView('weekly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  frequencyView === 'weekly'
                    ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                    : 'text-[#cbd5e1] hover:text-white'
                }`}
              >
                Past 8 Weeks
              </button>
              <button
                type="button"
                onClick={() => setFrequencyView('dayOfWeek')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  frequencyView === 'dayOfWeek'
                    ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                    : 'text-[#cbd5e1] hover:text-white'
                }`}
              >
                By Day of Week
              </button>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="h-72 sm:h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {frequencyView === 'weekly' ? (
                <BarChart data={weeklyFrequencyData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" vertical={false} />
                  <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    allowDecimals={false}
                    unit="x"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2d4554',
                      borderColor: '#3f5d70',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f1f5f9',
                    }}
                    formatter={(value: any) => [`${value} workouts`, 'Frequency']}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="workouts" radius={[6, 6, 0, 0]}>
                    {weeklyFrequencyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.workouts > 0 ? (index === weeklyFrequencyData.length - 1 ? '#8fb89e' : '#8bb4cb') : '#3f5d70'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={dayOfWeekDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" vertical={false} />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    allowDecimals={false}
                    unit="x"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2d4554',
                      borderColor: '#3f5d70',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f1f5f9',
                    }}
                    formatter={(value: any) => [`${value} sessions completed`, 'Frequency']}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {dayOfWeekDistribution.map((entry, index) => (
                      <Cell
                        key={`day-${index}`}
                        fill={entry.count > 0 ? '#8bb4cb' : '#3f5d70'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Simplified Analytics Spotlight (6 cols on large, deep progression chart) */}
        <div className="lg:col-span-6 bg-[#3d5a6c] border border-[#4e7085] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#8bb4cb]" />
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Strength Progression Spotlight
                </h3>
              </div>

              {/* Lift Selector Dropdown */}
              {exercisesWithData.length > 0 && (
                <div className="relative">
                  <select
                    value={spotlightExercise}
                    onChange={(e) => setSpotlightExercise(e.target.value)}
                    className="appearance-none bg-[#2d4554] border border-[#3f5d70] text-white text-[11px] font-bold rounded-xl pl-2.5 pr-6 py-1 focus:outline-none focus:border-[#8bb4cb] cursor-pointer"
                  >
                    {exercisesWithData.slice(0, 10).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#94a3b8] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
            </div>

            <p className="text-xs text-[#cbd5e1] font-medium">
              1RM & working weight progression for {spotlightExercise || 'your key lifts'}.
            </p>
          </div>

          {spotlightChartData.length > 0 ? (
            <div className="h-72 sm:h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spotlightChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" vertical={false} />
                  <XAxis
                    type="number"
                    dataKey="timestamp"
                    domain={spotlightTimeDomain.domain}
                    scale="time"
                    ticks={spotlightTimeDomain.ticks}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return spotlightTimeDomain.isMultiYear
                        ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
                        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    unit="kg"
                    domain={spotlightYDomain}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2d4554',
                      borderColor: '#3f5d70',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f1f5f9',
                    }}
                    formatter={(value: any, name: any) => [`${value} kg`, name]}
                    labelFormatter={(labelVal: any) => {
                      if (!labelVal) return '';
                      const d = new Date(Number(labelVal));
                      return d.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimated1RM"
                    name="Est. 1RM"
                    stroke="#8bb4cb"
                    strokeWidth={3}
                    dot={{ r: 3.5, fill: '#8bb4cb', stroke: '#0e2938', strokeWidth: 1.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="maxWeight"
                    name="Working Weight"
                    stroke="#8fb89e"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: '#8fb89e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-[#cbd5e1] text-xs font-medium bg-[#2d4554] rounded-2xl border border-[#3f5d70] p-4">
              <Dumbbell className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
              <span>No recorded sets for this exercise yet. Complete a workout to see progression!</span>
            </div>
          )}

          <button
            onClick={() => onNavigate('analytics')}
            className="flex items-center justify-between text-xs text-[#8bb4cb] hover:text-white font-bold pt-2 hover:underline"
          >
            <span>Open Detailed Analytics & Curves</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Consistency Heatmap Card */}
      <ConsistencyHeatmap title="Consistency Activity Heatmap" defaultRange="180d" />

      {/* Lower Row: Recent PR Trophies + Last Workout Session Recap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent PR Breakthroughs */}
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-[#cc8d8d]" />
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Recent PR Breakthroughs
              </h3>
            </div>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs text-[#8bb4cb] hover:underline font-bold"
            >
              All PRs ({Object.keys(personalRecords).length})
            </button>
          </div>

          {recentPRs.length > 0 ? (
            <div className="space-y-2.5">
              {recentPRs.map((pr, idx) => (
                <div
                  key={idx}
                  className="bg-[#cc8d8d] rounded-2xl p-3.5 border border-[#b87676] flex items-center justify-between text-[#3b1212]"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-extrabold text-xs sm:text-sm text-[#3b1212]">
                      {pr.exercise_name}
                    </h4>
                    <p className="text-[11px] text-[#3b1212]/90 font-medium">
                      Est. 1RM: <strong>{pr.best_estimated_1rm} kg</strong> • Achieved:{' '}
                      {formatDate(pr.achieved_at)}
                    </p>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <div className="text-base sm:text-lg font-mono font-extrabold text-[#3b1212]">
                      {pr.max_weight}kg
                    </div>
                    <div className="text-[10px] text-[#3b1212] font-bold">
                      × {pr.max_reps_at_max_weight} reps
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#2d4554] border border-[#3f5d70] rounded-2xl p-6 text-center text-xs text-[#cbd5e1]">
              <Award className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
              <span>Log sets with new weights to unlock your trophy case!</span>
            </div>
          )}
        </div>

        {/* Last Completed Workout Recap */}
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HistoryIcon className="w-5 h-5 text-[#8bb4cb]" />
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Latest Completed Workout
              </h3>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-[#8bb4cb] hover:underline font-bold"
            >
              History ({sessions.length})
            </button>
          </div>

          {lastSession && lastSessionStats ? (
            <div className="bg-[#2d4554] border border-[#3f5d70] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-extrabold text-white">
                    Workout on {formatDate(lastSession.completed_at)}
                  </h4>
                  <div className="flex items-center space-x-2 text-xs text-[#cbd5e1] font-mono mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#8bb4cb]" />
                    <span>{formatRelativeDays(lastSession.completed_at)}</span>
                    <span>•</span>
                    <span>
                      {lastSessionStats.exercisesCount} movement{lastSessionStats.exercisesCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <span className="bg-[#274a38] text-[#8fb89e] border border-[#3c6e54] text-[10px] font-bold px-2.5 py-1 rounded-lg">
                  Completed
                </span>
              </div>

              {/* Movements performed in this workout */}
              {lastSessionStats.movements.length > 0 && (
                <div className="pt-2 border-t border-[#3f5d70] space-y-1.5">
                  <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">
                    Movements Performed
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {lastSessionStats.movements.map((m) => (
                      <div
                        key={m.name}
                        className="bg-[#3d5a6c] border border-[#4e7085] rounded-xl px-2.5 py-1.5 text-xs flex items-center space-x-2"
                      >
                        <span className="font-bold text-white">{m.name}</span>
                        <span className="text-[10px] font-mono text-[#cbd5e1] bg-[#2d4554] px-1.5 py-0.5 rounded">
                          {m.setsCount} sets{m.maxWeight > 0 ? ` • ${m.maxWeight}kg` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#3f5d70] text-center">
                <div className="bg-[#3d5a6c] p-2 rounded-xl">
                  <span className="text-[10px] text-[#cbd5e1] block">Movements</span>
                  <span className="text-sm font-extrabold text-white font-mono">
                    {lastSessionStats.exercisesCount}
                  </span>
                </div>
                <div className="bg-[#3d5a6c] p-2 rounded-xl">
                  <span className="text-[10px] text-[#cbd5e1] block">Total Sets</span>
                  <span className="text-sm font-extrabold text-white font-mono">
                    {lastSessionStats.setsCount}
                  </span>
                </div>
              </div>

              {lastSession.session_notes && (
                <p className="text-xs text-[#cbd5e1] italic bg-[#223541] p-2.5 rounded-xl border border-[#344e5e]">
                  "{lastSession.session_notes}"
                </p>
              )}
            </div>
          ) : (
            <div className="bg-[#2d4554] border border-[#3f5d70] rounded-2xl p-6 text-center text-xs text-[#cbd5e1]">
              <Calendar className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
              <span>No completed workouts logged yet. Your first session will recap here!</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <button
          onClick={() => onNavigate('workouts')}
          className="bg-[#2d4554] hover:bg-[#344e5e] border border-[#3f5d70] hover:border-[#8bb4cb] rounded-2xl p-4 text-left transition space-y-2 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#3d5a6c] border border-[#4e7085] flex items-center justify-center text-[#8bb4cb] group-hover:scale-105 transition">
            <Dumbbell className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-white flex items-center justify-between">
              <span>Exercises</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-[10px] text-[#cbd5e1]">Log sets & workouts</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('analytics')}
          className="bg-[#2d4554] hover:bg-[#344e5e] border border-[#3f5d70] hover:border-[#8bb4cb] rounded-2xl p-4 text-left transition space-y-2 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#3d5a6c] border border-[#4e7085] flex items-center justify-center text-[#8fb89e] group-hover:scale-105 transition">
            <LineChartIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-white flex items-center justify-between">
              <span>Analytics</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-[10px] text-[#cbd5e1]">Curves & heatmaps</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('history')}
          className="bg-[#2d4554] hover:bg-[#344e5e] border border-[#3f5d70] hover:border-[#8bb4cb] rounded-2xl p-4 text-left transition space-y-2 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#3d5a6c] border border-[#4e7085] flex items-center justify-center text-[#b9a1c6] group-hover:scale-105 transition">
            <HistoryIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-white flex items-center justify-between">
              <span>History</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-[10px] text-[#cbd5e1]">Set-by-set logs</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('routines')}
          className="bg-[#2d4554] hover:bg-[#344e5e] border border-[#3f5d70] hover:border-[#8bb4cb] rounded-2xl p-4 text-left transition space-y-2 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#3d5a6c] border border-[#4e7085] flex items-center justify-center text-[#8bb4cb] group-hover:scale-105 transition">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-white flex items-center justify-between">
              <span>Configuration</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:translate-x-0.5 transition" />
            </div>
            <p className="text-[10px] text-[#cbd5e1]">Manage exercises & groups</p>
          </div>
        </button>
      </div>

      {/* Starter Pack Fallback if zero routines exist */}
      {routines.length === 0 && (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-3xl p-6 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-[#8bb4cb] mx-auto" />
          <h3 className="font-extrabold text-base text-white">No Exercise Groups Set Up Yet</h3>
          <p className="text-xs text-[#cbd5e1] max-w-sm mx-auto font-medium">
            Load our pre-configured Push / Pull / Legs / Core starter exercises to start tracking with zero hassle!
          </p>
          <button
            onClick={() => loadStarterRoutines()}
            className="inline-flex items-center space-x-1.5 bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-sm hover:bg-[#749fb7] transition"
          >
            <span>Load Push / Pull / Legs / Core Starter Plan</span>
          </button>
        </div>
      )}
    </div>
  );
};
