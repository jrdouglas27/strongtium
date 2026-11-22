import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
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
  ArrowLeft,
  Dumbbell,
  Repeat,
  Calendar,
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

  const [focusedMovement, setFocusedMovement] = useState<string>('all');

  const [selectedExercise, setSelectedExercise] = useState<string>(
    exerciseNames[0] || 'Barbell Bench Press'
  );

  React.useEffect(() => {
    if (exerciseNames.length > 0 && !exerciseNames.includes(selectedExercise)) {
      setSelectedExercise(exerciseNames[0]);
    }
  }, [exerciseNames, selectedExercise]);

  React.useEffect(() => {
    if (focusedMovement !== 'all' && exerciseNames.length > 0 && !exerciseNames.includes(focusedMovement)) {
      setFocusedMovement('all');
    }
  }, [exerciseNames, focusedMovement]);

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

  // Detailed per-movement data when a single movement is focused
  const focusedMovementData = useMemo(() => {
    if (focusedMovement === 'all') return null;

    const target = focusedMovement.trim().toLowerCase();
    const sortedSessions = [...sessions]
      .filter((s) => s.completed_at || s.started_at)
      .sort(
        (a, b) =>
          new Date(a.completed_at || a.started_at!).getTime() -
          new Date(b.completed_at || b.started_at!).getTime()
      );

    const points: {
      timestamp: number;
      date: string;
      rawDate: string;
      maxWeight: number;
      estimated1RM: number;
      normalized1RMPercent: number;
      maxReps: number;
      avgReps: number;
      totalReps: number;
      setsCount: number;
      repsAtMax: number;
      sets: { setNumber: number; weight: number; reps: number }[];
      notes?: string;
    }[] = [];

    let baseline1RM: number | null = null;

    sortedSessions.forEach((session) => {
      const dateStr = session.completed_at || session.started_at;
      if (!dateStr) return;
      const ex = session.logged_exercises?.find(
        (le) => le.exercise_name.trim().toLowerCase() === target
      );
      if (!ex || !ex.sets || ex.sets.length === 0) return;

      let maxW = 0;
      let repsAtMax = 0;
      let best1RM = 0;
      let maxReps = 0;
      let totalReps = 0;

      ex.sets.forEach((s) => {
        const w = Number(s.weight) || 0;
        const r = Number(s.reps) || 0;
        totalReps += r;
        if (r > maxReps) maxReps = r;
        if (w > maxW) {
          maxW = w;
          repsAtMax = r;
        }
        const est = calculate1RM(w, r);
        if (est > best1RM) best1RM = est;
      });

      if (baseline1RM === null && best1RM > 0) {
        baseline1RM = best1RM;
      }

      const normalized1RMPercent =
        baseline1RM && baseline1RM > 0 && best1RM > 0
          ? Math.round(((best1RM - baseline1RM) / baseline1RM) * 1000) / 10
          : 0;

      const d = new Date(dateStr);
      points.push({
        timestamp: d.getTime(),
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        rawDate: dateStr,
        maxWeight: maxW,
        estimated1RM: best1RM,
        normalized1RMPercent,
        maxReps,
        avgReps: Math.round((totalReps / ex.sets.length) * 10) / 10,
        totalReps,
        setsCount: ex.sets.length,
        repsAtMax,
        sets: ex.sets.map((s) => ({
          setNumber: s.set_number,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
        notes: ex.exercise_notes,
      });
    });

    // Summary stats
    let peak1RM = 0;
    let peakWeight = 0;
    let peakWeightReps = 0;
    let peakReps = 0;
    let totalRepsAll = 0;
    let totalSetsAll = 0;

    points.forEach((p) => {
      if (p.estimated1RM > peak1RM) peak1RM = p.estimated1RM;
      if (p.maxWeight > peakWeight) {
        peakWeight = p.maxWeight;
        peakWeightReps = p.repsAtMax;
      }
      if (p.maxReps > peakReps) peakReps = p.maxReps;
      totalRepsAll += p.totalReps;
      totalSetsAll += p.setsCount;
    });

    const latestPoint = points[points.length - 1];
    const overall1RMChangePct = latestPoint ? latestPoint.normalized1RMPercent : 0;
    const avgRepsPerSet = totalSetsAll > 0 ? Math.round((totalRepsAll / totalSetsAll) * 10) / 10 : 0;

    const timeDomain = getTimeDomain(points.map((p) => p.timestamp));
    const weightYDomain = getWeightYDomain(
      points.flatMap((p) => [p.estimated1RM, p.maxWeight]).filter((v) => v > 0)
    );
    const percentYDomain = getPercentYDomain(points.map((p) => p.normalized1RMPercent));
    const repsYDomain = getWeightYDomain(
      points.flatMap((p) => [p.maxReps, p.avgReps]).filter((v) => v > 0)
    );

    return {
      points,
      timeDomain,
      weightYDomain,
      percentYDomain,
      repsYDomain,
      summary: {
        sessionsCount: points.length,
        lastDate: latestPoint?.rawDate || null,
        peak1RM,
        overall1RMChangePct,
        peakWeight,
        peakWeightReps,
        peakReps,
        avgRepsPerSet,
        totalRepsAll,
        totalSetsAll,
      },
    };
  }, [focusedMovement, sessions]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Analytics Scope Selector Bar */}
      <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          {focusedMovement !== 'all' && (
            <button
              type="button"
              onClick={() => setFocusedMovement('all')}
              className="p-2 bg-[#2d4554] hover:bg-[#223541] border border-[#3f5d70] rounded-xl text-[#8bb4cb] hover:text-white transition"
              title="Back to All Movements Overview"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-[#8bb4cb]" />
              <span>
                {focusedMovement === 'all'
                  ? 'Strength & Consistency Analytics'
                  : `${focusedMovement} — Deep Analysis`}
              </span>
            </h2>
            <p className="text-xs text-[#cbd5e1] font-medium">
              {focusedMovement === 'all'
                ? 'Select a specific movement from the dropdown to view dedicated calendar, weight, rep, and 1RM% analytics.'
                : `Showing activity calendar, weight & 1RM progression, rep performance, and normalized % growth solely for ${focusedMovement}.`}
            </p>
          </div>
        </div>

        {/* Movement Dropdown Selector */}
        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          <div className="relative">
            <select
              value={focusedMovement}
              onChange={(e) => setFocusedMovement(e.target.value)}
              className="appearance-none bg-[#2d4554] border border-[#3f5d70] text-white text-xs font-extrabold rounded-xl pl-3.5 pr-9 py-2.5 focus:outline-none focus:border-[#8bb4cb] cursor-pointer shadow-sm"
            >
              <option value="all">All Movements (Overview)</option>
              {exerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#8bb4cb] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {focusedMovement !== 'all' && focusedMovementData ? (
        /* ==================== SINGLE MOVEMENT ANALYSIS PAGE ==================== */
        <div className="space-y-6">
          {/* 4 Movement KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center space-x-1.5 text-[#8bb4cb] text-xs font-bold mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Sessions Logged</span>
              </div>
              <p className="text-2xl font-extrabold text-white">
                {focusedMovementData.summary.sessionsCount}
              </p>
              <p className="text-[11px] text-[#cbd5e1] mt-0.5">
                {focusedMovementData.summary.totalSetsAll} total sets
              </p>
            </div>

            <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center space-x-1.5 text-[#8fb89e] text-xs font-bold mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Best Est. 1RM</span>
              </div>
              <p className="text-2xl font-extrabold text-white font-mono">
                {focusedMovementData.summary.peak1RM}
                <span className="text-xs font-sans text-[#cbd5e1] ml-1">kg</span>
              </p>
              <p className="text-[11px] text-[#8fb89e] font-bold mt-0.5">
                {focusedMovementData.summary.overall1RMChangePct >= 0
                  ? `+${focusedMovementData.summary.overall1RMChangePct}%`
                  : `${focusedMovementData.summary.overall1RMChangePct}%`}{' '}
                vs baseline
              </p>
            </div>

            <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center space-x-1.5 text-[#cc8d8d] text-xs font-bold mb-1">
                <Dumbbell className="w-3.5 h-3.5" />
                <span>Top Weight</span>
              </div>
              <p className="text-2xl font-extrabold text-white font-mono">
                {focusedMovementData.summary.peakWeight}
                <span className="text-xs font-sans text-[#cbd5e1] ml-1">kg</span>
              </p>
              <p className="text-[11px] text-[#cbd5e1] mt-0.5">
                × {focusedMovementData.summary.peakWeightReps} reps
              </p>
            </div>

            <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center space-x-1.5 text-[#b9a1c6] text-xs font-bold mb-1">
                <Repeat className="w-3.5 h-3.5" />
                <span>Rep Performance</span>
              </div>
              <p className="text-2xl font-extrabold text-white font-mono">
                {focusedMovementData.summary.peakReps}
                <span className="text-xs font-sans text-[#cbd5e1] ml-1">max reps</span>
              </p>
              <p className="text-[11px] text-[#cbd5e1] mt-0.5">
                Avg {focusedMovementData.summary.avgRepsPerSet} reps / set
              </p>
            </div>
          </div>

          {/* Movement-Specific GitHub-Style Activity Calendar */}
          <ConsistencyHeatmap
            title={`${focusedMovement} Activity Calendar`}
            defaultRange="180d"
            filterExerciseName={focusedMovement}
          />

          {/* 2x2 Deep Progression Graphs */}
          {focusedMovementData.points.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Graph 1: Weight & Est. 1RM */}
              <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-[#8bb4cb]" />
                    <span>Weight & Estimated 1RM (kg)</span>
                  </h3>
                  <p className="text-xs text-[#cbd5e1] font-medium">
                    Peak working weight and Epley 1RM over time
                  </p>
                </div>
                <div className="h-72 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={focusedMovementData.points} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" />
                      <XAxis
                        type="number"
                        dataKey="timestamp"
                        domain={focusedMovementData.timeDomain.domain}
                        scale="time"
                        ticks={focusedMovementData.timeDomain.ticks}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return focusedMovementData.timeDomain.isMultiYear
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
                        domain={focusedMovementData.weightYDomain}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#2d4554',
                          borderColor: '#3f5d70',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any, name: any) => [`${value} kg`, name]}
                        labelFormatter={(val: any) =>
                          val
                            ? new Date(Number(val)).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
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
              </div>

              {/* Graph 2: Normalized % Improvement on 1RM */}
              <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-[#8fb89e]" />
                    <span>Normalized 1RM Improvement (%)</span>
                  </h3>
                  <p className="text-xs text-[#cbd5e1] font-medium">
                    Percentage 1RM change relative to your first recorded session (0% baseline)
                  </p>
                </div>
                <div className="h-72 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={focusedMovementData.points} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" />
                      <XAxis
                        type="number"
                        dataKey="timestamp"
                        domain={focusedMovementData.timeDomain.domain}
                        scale="time"
                        ticks={focusedMovementData.timeDomain.ticks}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return focusedMovementData.timeDomain.isMultiYear
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
                        domain={focusedMovementData.percentYDomain}
                        tickFormatter={(val) => `${val > 0 ? `+${val}` : val}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#2d4554',
                          borderColor: '#3f5d70',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any) => [
                          `${Number(value) > 0 ? `+${value}` : value}%`,
                          '1RM vs Baseline',
                        ]}
                        labelFormatter={(val: any) =>
                          val
                            ? new Date(Number(val)).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line
                        type="monotone"
                        dataKey="normalized1RMPercent"
                        name="1RM Improvement (%)"
                        stroke="#8fb89e"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#8fb89e', stroke: '#223541' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Graph 3: Reps per Set (Max Reps & Avg Reps) */}
              <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                    <Repeat className="w-4 h-4 text-[#b9a1c6]" />
                    <span>Reps per Set (Max & Average)</span>
                  </h3>
                  <p className="text-xs text-[#cbd5e1] font-medium">
                    Track rep-range progression and single-set rep PRs across sessions
                  </p>
                </div>
                <div className="h-72 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={focusedMovementData.points} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" />
                      <XAxis
                        type="number"
                        dataKey="timestamp"
                        domain={focusedMovementData.timeDomain.domain}
                        scale="time"
                        ticks={focusedMovementData.timeDomain.ticks}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return focusedMovementData.timeDomain.isMultiYear
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
                        domain={focusedMovementData.repsYDomain}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#2d4554',
                          borderColor: '#3f5d70',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any, name: any) => [`${value} reps`, name]}
                        labelFormatter={(val: any) =>
                          val
                            ? new Date(Number(val)).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line
                        type="monotone"
                        dataKey="maxReps"
                        name="Max Reps in a Set"
                        stroke="#b9a1c6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#b9a1c6', stroke: '#223541' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgReps"
                        name="Avg Reps / Set"
                        stroke="#8bb4cb"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: '#8bb4cb', stroke: '#223541' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Graph 4: Total Reps per Session */}
              <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-[#cc8d8d]" />
                    <span>Total Reps & Sets per Session</span>
                  </h3>
                  <p className="text-xs text-[#cbd5e1] font-medium">
                    Cumulative reps performed each session for {focusedMovement}
                  </p>
                </div>
                <div className="h-72 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={focusedMovementData.points} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4e7085" vertical={false} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#2d4554',
                          borderColor: '#3f5d70',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any, _name: any, item: any) => [
                          `${value} total reps (${item.payload.setsCount} sets)`,
                          'Session Reps',
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar
                        dataKey="totalReps"
                        name="Total Reps"
                        fill="#8bb4cb"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-10 text-center text-xs text-[#cbd5e1]">
              No logged sets found for {focusedMovement} yet.
            </div>
          )}

          {/* Session-by-Session Breakdown for Focused Movement */}
          {focusedMovementData.points.length > 0 && (
            <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-white tracking-tight">
                Session History — {focusedMovement}
              </h3>
              <div className="space-y-2">
                {[...focusedMovementData.points].reverse().map((p, idx) => (
                  <div
                    key={idx}
                    className="bg-[#2d4554] border border-[#3f5d70] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">{formatDate(p.rawDate)}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#3d5a6c] text-[#8bb4cb] border border-[#4e7085]">
                          Est. 1RM: {p.estimated1RM}kg
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            p.normalized1RMPercent > 0
                              ? 'bg-[#274a38] text-[#8fb89e] border-[#3c6e54]'
                              : p.normalized1RMPercent < 0
                              ? 'bg-[#422020] text-[#fca5a5] border-[#7f1d1d]'
                              : 'bg-[#3d5a6c] text-[#cbd5e1] border-[#4e7085]'
                          }`}
                        >
                          {p.normalized1RMPercent > 0
                            ? `+${p.normalized1RMPercent}%`
                            : `${p.normalized1RMPercent}%`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.sets.map((st, sIdx) => (
                          <span
                            key={sIdx}
                            className="bg-[#3d5a6c] border border-[#4e7085] px-2 py-0.5 rounded font-mono text-[11px] text-[#f1f5f9]"
                          >
                            S{st.setNumber}: <strong>{st.weight}kg</strong> × {st.reps}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono text-[11px] text-[#cbd5e1]">
                      <div>{p.totalReps} total reps</div>
                      <div className="text-[#94a3b8]">avg {p.avgReps} reps/set</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================== ALL MOVEMENTS OVERVIEW PAGE ==================== */
        <>
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
                    labelFormatter={(val: any, payload: any) => {
                      const range = payload?.[0]?.payload?.rawDate;
                      if (range) return `2-Week Period: ${range}`;
                      if (!val) return '';
                      const d = new Date(Number(val));
                      return d.toLocaleDateString(undefined, {
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
              2-week binned average % 1RM growth using each movement&apos;s best attempt per 2-week period
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
                    labelFormatter={(val: any, payload: any) => {
                      const range = payload?.[0]?.payload?.rawDate;
                      if (range) return `2-Week Period: ${range}`;
                      if (!val) return '';
                      const d = new Date(Number(val));
                      return d.toLocaleDateString(undefined, {
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
              <button
                type="button"
                key={idx}
                onClick={() => setFocusedMovement(pr.exercise_name)}
                className="bg-[#cc8d8d] hover:bg-[#c27e7e] rounded-xl p-3.5 border border-[#b87676] flex items-center justify-between text-[#3b1212] text-left transition cursor-pointer"
                title={`View dedicated analytics for ${pr.exercise_name}`}
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
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#cbd5e1] italic">
            Complete workouts to log personal records!
          </p>
        )}
      </div>
        </>
      )}
    </div>
  );
};
