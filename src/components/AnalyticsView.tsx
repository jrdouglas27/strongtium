import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Calendar,
  Zap,
  Activity,
  ChevronDown,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { calculate1RM, formatDate } from '../lib/calculations';

export const AnalyticsView: React.FC = () => {
  const { sessions, personalRecords } = useWorkout();

  const exerciseNames = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      s.logged_exercises?.forEach((le) => {
        if (le.exercise_name?.trim()) {
          set.add(le.exercise_name.trim());
        }
      });
    });
    return Array.from(set).sort();
  }, [sessions]);

  const [selectedExercise, setSelectedExercise] = useState<string>(
    exerciseNames[0] || 'Barbell Bench Press'
  );

  React.useEffect(() => {
    if (exerciseNames.length > 0 && !exerciseNames.includes(selectedExercise)) {
      setSelectedExercise(exerciseNames[0]);
    }
  }, [exerciseNames, selectedExercise]);

  const chartData = useMemo(() => {
    if (!selectedExercise) return [];

    const points: {
      date: string;
      rawDate: string;
      maxWeight: number;
      estimated1RM: number;
      totalVolume: number;
      repsAtMax: number;
      notes?: string;
    }[] = [];

    const sortedSessions = [...sessions].reverse();

    sortedSessions.forEach((session) => {
      if (!session.completed_at) return;
      const ex = session.logged_exercises?.find(
        (le) => le.exercise_name.trim().toLowerCase() === selectedExercise.trim().toLowerCase()
      );

      if (ex && ex.sets.length > 0) {
        let maxW = 0;
        let best1RM = 0;
        let repsAtMax = 0;
        let vol = 0;

        ex.sets.forEach((s) => {
          const w = Number(s.weight) || 0;
          const r = Number(s.reps) || 0;
          vol += w * r;
          const est = calculate1RM(w, r);

          if (w > maxW) {
            maxW = w;
            repsAtMax = r;
          }
          if (est > best1RM) {
            best1RM = est;
          }
        });

        points.push({
          date: new Date(session.completed_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
          rawDate: session.completed_at,
          maxWeight: maxW,
          estimated1RM: best1RM,
          totalVolume: vol,
          repsAtMax,
          notes: ex.exercise_notes,
        });
      }
    });

    return points;
  }, [sessions, selectedExercise]);

  const heatmapDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const sessionDates = new Set(
      sessions
        .filter((s) => s.completed_at)
        .map((s) => new Date(s.completed_at!).toISOString().split('T')[0])
    );

    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hasWorkout = sessionDates.has(dateStr);

      days.push({
        date: dateStr,
        displayDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        hasWorkout,
      });
    }
    return days;
  }, [sessions]);

  const totalWorkouts = sessions.filter((s) => s.completed_at).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Overview Cards (Muted Slate Surfaces) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-1.5 text-[#8bb4cb] text-xs font-bold mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Total Workouts</span>
          </div>
          <p className="text-2xl font-extrabold text-white">{totalWorkouts}</p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-1.5 text-[#cc8d8d] text-xs font-bold mb-1">
            <Award className="w-3.5 h-3.5" />
            <span>PR Breakthroughs</span>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {Object.keys(personalRecords).length}
          </p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-1.5 text-[#8fb89e] text-xs font-bold mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Exercises Logged</span>
          </div>
          <p className="text-2xl font-extrabold text-white">{exerciseNames.length}</p>
        </div>

        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-1.5 text-[#b9a1c6] text-xs font-bold mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Cycle Rule</span>
          </div>
          <p className="text-2xl font-extrabold text-white">3 Days</p>
        </div>
      </div>

      {/* Consistency Heatmap */}
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#8bb4cb]" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Consistency Activity (Last 60 Days)
            </h3>
          </div>
          <span className="text-xs text-[#cbd5e1] font-mono font-medium">
            {heatmapDays.filter((d) => d.hasWorkout).length} active days
          </span>
        </div>

        <div className="grid grid-flow-col grid-rows-6 gap-1.5 overflow-x-auto py-1">
          {heatmapDays.map((day, idx) => (
            <div
              key={idx}
              title={`${day.displayDate}: ${day.hasWorkout ? 'Workout Completed' : 'Rest Day'}`}
              className={`w-3.5 h-3.5 rounded-sm border ${
                day.hasWorkout
                  ? 'bg-[#8bb4cb] border-[#749fb7]'
                  : 'bg-[#2d4554] border-[#3f5d70]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Exercise Progression Chart */}
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#8bb4cb]" />
              <span>Progression Curves (1RM & Max Weight)</span>
            </h3>
            <p className="text-xs text-[#cbd5e1] font-medium">
              Calculated via Epley 1RM equation
            </p>
          </div>

          {/* Exercise Selector */}
          <div className="relative">
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="appearance-none bg-[#2d4554] border border-[#3f5d70] text-white text-xs font-bold rounded-xl pl-3.5 pr-8 py-2 focus:outline-none focus:border-[#8bb4cb] cursor-pointer shadow-sm"
            >
              {exerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="kg" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#2d4554',
                    borderColor: '#3f5d70',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                    fontSize: '12px',
                    color: '#f1f5f9',
                  }}
                  formatter={(value: any, name: any) => [`${value} kg`, name]}
                  labelStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="estimated1RM"
                  name="Est. 1RM"
                  stroke="#8bb4cb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#8bb4cb', stroke: '#223541' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="maxWeight"
                  name="Max Working Weight"
                  stroke="#8fb89e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#8fb89e', stroke: '#223541' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-[#cbd5e1] text-xs font-medium">
            No completed sessions found for this exercise yet. Complete a workout to see your progress curve!
          </div>
        )}
      </div>

      {/* Personal Records Trophy Room */}
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 mb-3.5">
          <Award className="w-5 h-5 text-[#cc8d8d]" />
          <h3 className="text-base font-bold text-white tracking-tight">
            Personal Records (PR) Catalog
          </h3>
        </div>

        {Object.keys(personalRecords).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(personalRecords).map((pr, idx) => (
              <div
                key={idx}
                className="bg-[#cc8d8d] rounded-xl p-3.5 border border-[#b87676] flex items-center justify-between text-[#3b1212]"
              >
                <div>
                  <h4 className="font-bold text-sm text-[#3b1212]">{pr.exercise_name}</h4>
                  <div className="text-[11px] text-[#3b1212]/90 mt-0.5 font-medium">
                    Est. 1RM: <strong className="text-[#3b1212]">{pr.best_estimated_1rm} kg</strong>
                  </div>
                  <div className="text-[10px] text-[#3b1212]/80 mt-1">
                    Achieved: {formatDate(pr.achieved_at)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-lg font-extrabold text-[#3b1212] font-mono">
                    {pr.max_weight}
                    <span className="text-xs text-[#3b1212]/80 ml-0.5">kg</span>
                  </span>
                  <div className="text-[10px] text-[#3b1212] font-semibold">
                    × {pr.max_reps_at_max_weight} reps
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#cbd5e1] italic">
            Complete workouts to log personal records!
          </p>
        )}
      </div>
    </div>
  );
};
