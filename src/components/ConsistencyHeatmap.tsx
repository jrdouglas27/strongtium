import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { toLocalISODate } from '../lib/calculations';

interface ConsistencyHeatmapProps {
  title?: string;
  defaultRange?: '90d' | '180d' | '365d';
  className?: string;
}

interface HeatmapDayData {
  dateStr: string;
  displayDate: string;
  fullDateLabel: string;
  dayOfWeek: number; // 0 = Mon ... 6 = Sun
  count: number;
  setsCount: number;
  volume: number;
  routines: string[];
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}

interface HeatmapWeekData {
  weekIndex: number;
  monthLabel?: string;
  days: HeatmapDayData[];
}

export const ConsistencyHeatmap: React.FC<ConsistencyHeatmapProps> = ({
  title = 'Consistency Activity',
  defaultRange = '180d',
  className = '',
}) => {
  const { sessions } = useWorkout();
  const [range, setRange] = useState<'90d' | '180d' | '365d'>(defaultRange);
  const [hoveredDay, setHoveredDay] = useState<HeatmapDayData | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Map completed workouts by date (YYYY-MM-DD)
  const activityMap = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        setsCount: number;
        volume: number;
        routines: string[];
      }
    >();

    sessions.forEach((s) => {
      if (!s.completed_at) return;
      const dateStr = new Date(s.completed_at).toISOString().split('T')[0];
      const existing = map.get(dateStr) || {
        count: 0,
        setsCount: 0,
        volume: 0,
        routines: [],
      };

      existing.count += 1;
      if (s.routine_name && !existing.routines.includes(s.routine_name)) {
        existing.routines.push(s.routine_name);
      }

      (s.logged_exercises || []).forEach((le) => {
        (le.sets || []).forEach((st) => {
          existing.setsCount += 1;
          existing.volume += (Number(st.weight) || 0) * (Number(st.reps) || 0);
        });
      });

      map.set(dateStr, existing);
    });

    return map;
  }, [sessions]);

  // Compute number of weeks based on selected range
  const numWeeks = useMemo(() => {
    switch (range) {
      case '90d':
        return 14; // ~98 days
      case '180d':
        return 26; // ~182 days (approx 6 months)
      case '365d':
        return 52; // 1 full year
      default:
        return 26;
    }
  }, [range]);

  // Generate GitHub-style 7-day columns (Monday to Sunday)
  const { weeks, totalActiveDays, totalTrackedDays, activePercentage } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStr = toLocalISODate();

    // Monday is index 0, Sunday is index 6
    const todayMonIndex = (today.getDay() + 6) % 7;

    // End of current week (Sunday)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - todayMonIndex));
    endOfWeek.setHours(23, 59, 59, 999);

    // Start Monday N weeks ago
    const startMonday = new Date(endOfWeek);
    startMonday.setDate(endOfWeek.getDate() - (numWeeks * 7 - 1));
    startMonday.setHours(0, 0, 0, 0);

    const generatedWeeks: HeatmapWeekData[] = [];
    let activeDaysCount = 0;
    let pastDaysCount = 0;
    let lastMonthSeen = -1;

    for (let w = 0; w < numWeeks; w++) {
      const weekDays: HeatmapDayData[] = [];
      let weekMonthLabel: string | undefined = undefined;

      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const d = new Date(startMonday);
        d.setDate(startMonday.getDate() + (w * 7 + dIdx));
        const dateStr = d.toISOString().split('T')[0];

        const isToday = dateStr === todayStr;
        const isFuture = d > today;

        // Check if this week begins a new month
        const m = d.getMonth();
        if (dIdx === 0 || d.getDate() <= 7) {
          if (m !== lastMonthSeen) {
            lastMonthSeen = m;
            weekMonthLabel = d.toLocaleDateString(undefined, { month: 'short' });
          }
        }

        const act = activityMap.get(dateStr);
        const count = act?.count || 0;
        const setsCount = act?.setsCount || 0;
        const volume = act?.volume || 0;
        const routines = act?.routines || [];

        // GitHub 5-level intensity calculation
        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (!isFuture && count > 0) {
          activeDaysCount++;
          if (volume >= 3500 || setsCount >= 14) {
            level = 4;
          } else if (volume >= 2000 || setsCount >= 10) {
            level = 3;
          } else if (volume >= 1000 || setsCount >= 6) {
            level = 2;
          } else {
            level = 1;
          }
        }

        if (!isFuture) {
          pastDaysCount++;
        }

        weekDays.push({
          dateStr,
          displayDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          fullDateLabel: d.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          dayOfWeek: dIdx,
          count,
          setsCount,
          volume,
          routines,
          level,
          isToday,
          isFuture,
        });
      }

      generatedWeeks.push({
        weekIndex: w,
        monthLabel: weekMonthLabel,
        days: weekDays,
      });
    }

    const pct = pastDaysCount > 0 ? Math.round((activeDaysCount / pastDaysCount) * 100) : 0;

    return {
      weeks: generatedWeeks,
      totalActiveDays: activeDaysCount,
      totalTrackedDays: pastDaysCount,
      activePercentage: pct,
    };
  }, [activityMap, numWeeks]);

  // Auto-scroll to the right (most recent days) on mount and range change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [range, weeks]);

  // Color classes for each squished tile
  const getLevelClasses = (level: 0 | 1 | 2 | 3 | 4, isToday: boolean) => {
    const todayRing = isToday ? 'ring-1 ring-[#8bb4cb] ring-offset-1 ring-offset-[#3d5a6c]' : '';

    switch (level) {
      case 4:
        return `bg-[#8fb89e] border-[#a9dbbd] ${todayRing}`;
      case 3:
        return `bg-[#66a380] border-[#7cb897] ${todayRing}`;
      case 2:
        return `bg-[#437d5f] border-[#529774] ${todayRing}`;
      case 1:
        return `bg-[#2e5d48] border-[#39745a] ${todayRing}`;
      case 0:
      default:
        return `bg-[#213543] border-[#294254] ${todayRing}`;
    }
  };

  return (
    <div className={`bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 ${className}`}>
      {/* Header with Title, Stats & Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#8bb4cb]" />
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              {title}
            </h3>
          </div>
          <p className="text-xs text-[#cbd5e1] font-medium mt-0.5">
            {totalActiveDays} active workout {totalActiveDays === 1 ? 'day' : 'days'} across {totalTrackedDays} days ({activePercentage}% consistency)
          </p>
        </div>

        {/* Range Selector Chips */}
        <div className="flex items-center space-x-1 bg-[#2d4554] border border-[#3f5d70] p-1 rounded-xl self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setRange('90d')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              range === '90d'
                ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                : 'text-[#cbd5e1] hover:text-white'
            }`}
          >
            90 Days
          </button>
          <button
            type="button"
            onClick={() => setRange('180d')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              range === '180d'
                ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                : 'text-[#cbd5e1] hover:text-white'
            }`}
          >
            6 Months
          </button>
          <button
            type="button"
            onClick={() => setRange('365d')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              range === '365d'
                ? 'bg-[#8bb4cb] text-[#0e2938] shadow-sm'
                : 'text-[#cbd5e1] hover:text-white'
            }`}
          >
            1 Year
          </button>
        </div>
      </div>

      {/* GitHub-style Squished Heatmap Container */}
      <div className="pt-1">
        <div className="flex gap-[3px] items-start">
          {/* Day of Week Labels on Left (Mon, Wed, Fri) */}
          <div className="flex flex-col gap-[3px] text-[9px] text-[#94a3b8] font-mono select-none pr-1.5 shrink-0 pt-[16px]">
            <span className="h-[12px] flex items-center leading-none">Mon</span>
            <span className="h-[12px] flex items-center leading-none opacity-0">Tue</span>
            <span className="h-[12px] flex items-center leading-none">Wed</span>
            <span className="h-[12px] flex items-center leading-none opacity-0">Thu</span>
            <span className="h-[12px] flex items-center leading-none">Fri</span>
            <span className="h-[12px] flex items-center leading-none opacity-0">Sat</span>
            <span className="h-[12px] flex items-center leading-none opacity-0">Sun</span>
          </div>

          {/* Scrollable Heatmap Weeks Area */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#4e7085] scrollbar-track-transparent"
          >
            <div className="inline-flex flex-col">
              {/* Month Header Row */}
              <div className="flex gap-[3px] h-[16px] text-[10px] font-mono select-none mb-[2px]">
                {weeks.map((w, wIdx) => (
                  <div key={wIdx} className="w-[12px] text-left shrink-0 relative">
                    {w.monthLabel && (
                      <span className="absolute left-0 top-0 whitespace-nowrap font-bold text-[#8bb4cb]">
                        {w.monthLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* 7 Rows x N Columns of Squished Squares */}
              <div className="flex gap-[3px]">
                {weeks.map((week) => (
                  <div key={week.weekIndex} className="flex flex-col gap-[3px] shrink-0">
                    {week.days.map((day) => {
                      if (day.isFuture) {
                        return (
                          <div
                            key={day.dateStr}
                            className="w-[12px] h-[12px] rounded-[2px] opacity-0 pointer-events-none"
                          />
                        );
                      }

                      return (
                        <div
                          key={day.dateStr}
                          onMouseEnter={() => setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`w-[12px] h-[12px] rounded-[2px] border transition-transform duration-75 hover:scale-150 hover:z-20 cursor-pointer ${getLevelClasses(
                            day.level,
                            day.isToday
                          )}`}
                          title={`${day.fullDateLabel}: ${
                            day.count > 0
                              ? `${day.routines.join(', ') || 'Workout'} (${day.setsCount} sets, ${Math.round(day.volume)}kg)`
                              : 'Rest Day'
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Tooltip & GitHub Legend Bar */}
      <div className="pt-2 border-t border-[#4e7085]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        {/* Dynamic Hover Details */}
        <div className="min-h-[22px] flex items-center">
          {hoveredDay ? (
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="font-bold text-white font-mono text-[11px]">
                {hoveredDay.fullDateLabel}:
              </span>
              {hoveredDay.count > 0 ? (
                <span className="text-[#8fb89e] font-semibold text-[11px] flex items-center space-x-1">
                  <span>
                    {hoveredDay.routines.join(', ') || 'Workout'} • {hoveredDay.setsCount} sets ({Math.round(hoveredDay.volume)}kg vol)
                  </span>
                </span>
              ) : (
                <span className="text-[#94a3b8] italic text-[11px]">Rest Day (No workouts)</span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-[#94a3b8]">
              Hover any square to view workout details & volume
            </span>
          )}
        </div>

        {/* GitHub Contribution Legend */}
        <div className="flex items-center space-x-1.5 text-[10px] text-[#94a3b8] shrink-0 font-mono self-end sm:self-auto">
          <span>Less</span>
          <div className="w-[10px] h-[10px] rounded-[2px] bg-[#213543] border border-[#294254]" title="0 workouts" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-[#2e5d48] border border-[#39745a]" title="Light session" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-[#437d5f] border border-[#529774]" title="Moderate session" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-[#66a380] border border-[#7cb897]" title="High volume" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-[#8fb89e] border border-[#a9dbbd]" title="Peak volume" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
