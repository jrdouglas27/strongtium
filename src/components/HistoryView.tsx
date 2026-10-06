import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  MessageSquareQuote,
} from 'lucide-react';
import { useWorkout } from '../context/WorkoutContext';
import { calculate1RM, formatDate } from '../lib/calculations';

export const HistoryView: React.FC = () => {
  const { sessions } = useWorkout();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    sessions[0]?.id || null
  );

  const completedSessions = sessions.filter((s) => s.completed_at);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Workout History</h2>
          <p className="text-xs text-[#cbd5e1] font-medium">
            {completedSessions.length} total logged sessions
          </p>
        </div>
      </div>

      {completedSessions.length === 0 ? (
        <div className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl p-12 text-center">
          <Dumbbell className="w-10 h-10 text-[#94a3b8] mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No logged workouts yet</h3>
          <p className="text-xs text-[#cbd5e1] mt-1 max-w-sm mx-auto font-medium">
            When you complete a routine, your sets, reps, and reflections will be archived here for
            set-by-set drilldown.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {completedSessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;

            const totalVol = (session.logged_exercises || []).reduce((acc, ex) => {
              return (
                acc +
                ex.sets.reduce((sAcc, s) => sAcc + Number(s.weight) * Number(s.reps), 0)
              );
            }, 0);

            const totalSets = (session.logged_exercises || []).reduce(
              (acc, ex) => acc + ex.sets.length,
              0
            );

            return (
              <div
                key={session.id}
                className="bg-[#3d5a6c] border border-[#4e7085] rounded-2xl overflow-hidden shadow-sm transition"
              >
                {/* Session Header Item */}
                <button
                  onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                  className="w-full text-left p-4 sm:p-5 flex items-center justify-between hover:bg-[#344e5e] transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-white">{session.routine_name}</h3>
                      <span className="bg-[#8bb4cb] text-[#0e2938] font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border border-[#749fb7]">
                        {totalSets} sets
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-[#cbd5e1] font-mono font-medium">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(session.completed_at)}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {new Date(session.completed_at!).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      <span>•</span>
                      <span>{Math.round(totalVol)} kg volume</span>
                    </div>
                  </div>

                  <div className="text-[#cbd5e1] p-1.5 bg-[#2d4554] border border-[#3f5d70] rounded-lg">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Session Drilldown Body */}
                {isExpanded && (
                  <div className="border-t border-[#4e7085] px-4 py-4 sm:px-5 sm:py-5 bg-[#2d4554] space-y-4">
                    {session.session_notes && (
                      <div className="bg-[#c9bda9] border border-[#b3a58e] p-3 rounded-xl text-xs text-[#332919] flex items-start space-x-2">
                        <MessageSquareQuote className="w-4 h-4 text-[#332919] shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-[#332919] block mb-0.5 font-bold">Session Reflection:</strong>
                          <p className="italic">{session.session_notes}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {session.logged_exercises?.map((ex, exIdx) => (
                        <div
                          key={exIdx}
                          className="bg-[#3d5a6c] border border-[#4e7085] rounded-xl p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                              <Dumbbell className="w-3.5 h-3.5 text-[#8bb4cb]" />
                              <span>{ex.exercise_name}</span>
                            </h4>
                          </div>

                          {/* Sets grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            {ex.sets.map((set, setIdx) => {
                              const est1RM = calculate1RM(Number(set.weight), Number(set.reps));
                              return (
                                <div
                                  key={setIdx}
                                  className="bg-[#2d4554] border border-[#3f5d70] p-2 rounded-lg text-xs"
                                >
                                  <div className="text-[10px] text-[#94a3b8] font-bold mb-0.5">
                                    Set {set.set_number}
                                  </div>
                                  <div className="font-mono font-bold text-white">
                                    {set.weight}kg × {set.reps}
                                  </div>
                                  <div className="text-[10px] text-[#8bb4cb] font-mono mt-0.5 font-bold">
                                    Est. 1RM: {est1RM}kg
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Exercise note if any */}
                          {ex.exercise_notes && (
                            <div className="text-[11px] text-[#332919] italic bg-[#c9bda9] px-2.5 py-1 rounded-md border border-[#b3a58e]">
                              "{ex.exercise_notes}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
