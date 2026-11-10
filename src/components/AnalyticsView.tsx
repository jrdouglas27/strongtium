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
  Zap,
  Activity,
  ChevronDown,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import {
  calculate1RM,
  formatDate,
  getTimeDomain,
  calculateNormalizedProgression,
  getWeightYDomain,
  getPercentYDomain,
} from '../lib/calculations';
import { ConsistencyHeatmap } from './ConsistencyHeatmap';

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

  // Normalized progression calculation across all exercises
  const normalizedData = useMemo(() => {
    return calculateNormalizedProgression(sessions);
  }, [sessions]);

  const normalizedTimeDomain = useMemo(() => {
    return getTimeDomain(normalizedData.map((p) => p.timestamp));
  }, [normalizedData]);

  const normalizedYDomain = useMemo(() => {
    return getPercentYDomain(normalizedData.map((p) => p.normalizedGrowthPercent));
  }, [normalizedData]);

  const chartData = useMemo(() => {
    if (!selectedExercise) return [];

    const points: {
      timestamp: number;
      date: string;
      rawDate: string;
      maxWeight: number;
      estimated1RM: number;
      totalVolume: number;
      repsAtMax: number;
      notes?: string;
    }[] = [];

    const sortedSessions = [...sessions]
      .filter((s) => s.completed_at || s.started_at)
      .sort(
        (a, b) =>
          new Date(a.completed_at || a.started_at!).getTime() -
          new Date(b.completed_at || b.started_at!).getTime()
      );

    sortedSessions.forEach((session) => {
      const dateStr = session.completed_at || session.started_at;
      if (!dateStr) return;
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

        const d = new Date(dateStr);
        points.push({
          timestamp: d.getTime(),
          date: d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
          rawDate: dateStr,
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

  const timeDomain = useMemo(() => {
    return getTimeDomain(chartData.map((p) => p.timestamp));
  }, [chartData]);

  const weightYDomain = useMemo(() => {
    const vals: number[] = [];
    chartData.forEach((p) => {
      if (p.estimated1RM > 0) vals.push(p.estimated1RM);
      if (p.maxWeight > 0) vals.push(p.maxWeight);
    });
    return getWeightYDomain(vals);
  }, [chartData]);

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

      {/* GitHub-Style Squished Consistency Heatmap */}
      <ConsistencyHeatmap title="Consistency Activity" defaultRange="180d" />

      {/* Side-by-Side Deep Progression Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Graph: Individual Movement Progression */}
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#8bb4cb]" />
                <span>Movement Progression (1RM & Weight)</span>
              </h3>
              <p className="text-xs text-[#cbd5e1] font-medium">
                Calculated via Epley 1RM equation
              </p>
            </div>

            {/* Exercise Selector */}
            <div className="relative self-start sm:self-auto">
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
            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" />
                  <XAxis
                    type="number"
                    dataKey="timestamp"
                    domain={timeDomain.domain}
                    scale="time"
                    ticks={timeDomain.ticks}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return timeDomain.isMultiYear
                        ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
                        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    unit="kg"
                    domain={weightYDomain}
                  />
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
                    labelFormatter={(val: any) => {
                      if (!val) return '';
                      const d = new Date(Number(val));
                      return d.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                    }}
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
            <div className="py-20 text-center text-[#cbd5e1] text-xs font-medium">
              No completed sessions found for this exercise yet. Complete a workout to see your progress curve!
            </div>
          )}
        </div>

        {/* Right Graph: Composite Normalized Progression Across All Exercises */}
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-5">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#8fb89e]" />
              <span>Composite Strength Growth (All Movements)</span>
            </h3>
            <p className="text-xs text-[#cbd5e1] font-medium">
              Average percentage 1RM change across all movements relative to their initial baselines
            </p>
          </div>

          {normalizedData.length > 0 ? (
            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={normalizedData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" />
                  <XAxis
                    type="number"
                    dataKey="timestamp"
                    domain={normalizedTimeDomain.domain}
                    scale="time"
                    ticks={normalizedTimeDomain.ticks}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return normalizedTimeDomain.isMultiYear
                        ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
                        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    domain={normalizedYDomain}
                    tickFormatter={(val) => `${val > 0 ? `+${val}` : val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2d4554',
                      borderColor: '#3f5d70',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                      fontSize: '12px',
                      color: '#f1f5f9',
                    }}
                    formatter={(value: any, _name: any, item: any) => [
                      `${Number(value) > 0 ? `+${value}` : value}% (${item.payload.coveredExercisesCount} movements tracked)`,
                      'Average Growth vs Baseline',
                    ]}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                    labelFormatter={(val: any) => {
                      if (!val) return '';
                      const d = new Date(Number(val));
                      return d.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="normalizedGrowthPercent"
                    name="Overall Strength Growth (%)"
                    stroke="#8fb89e"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#8fb89e', stroke: '#223541' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-20 text-center text-[#cbd5e1] text-xs font-medium">
              Log workout sessions across your movements to view your composite normalized growth curve!
            </div>
          )}
        </div>
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
