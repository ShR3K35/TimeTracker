import React, { useState, useEffect } from 'react';
import './TimesheetView.css';

interface TaskGroup {
  issueKey: string;
  issueTitle: string;
  issueType: string;
  sessions: any[];
  totalSeconds: number;
  adjustedSeconds?: number;
}

interface DayData {
  date: string;
  sessions: any[];
  taskGroups: TaskGroup[];
  totalMinutes: number;
  status: 'draft' | 'pending' | 'ready' | 'sent';
  summary?: any;
}

function TimesheetView() {
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxDailyHours, setMaxDailyHours] = useState(7.5);

  useEffect(() => {
    loadRecentDays();
    analyzeAdjustments();
    loadMaxDailyHours();
  }, []);

  const loadMaxDailyHours = async () => {
    try {
      const hours = await window.electronAPI.adjustments.getMaxHours();
      setMaxDailyHours(hours);
    } catch (err) {
      console.error('Error loading max daily hours:', err);
    }
  };

  const loadRecentDays = async () => {
    try {
      setLoading(true);

      // Get last 14 days
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 13);

      const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

      const sessions = await window.electronAPI.sessions.getByRange(
        formatDateStr(startDate),
        formatDateStr(today)
      );

      const summaries = await window.electronAPI.summaries.getByRange(
        formatDateStr(startDate),
        formatDateStr(today)
      );

      // Group sessions by date
      const sessionsByDate: Record<string, any[]> = {};
      sessions.forEach((session: any) => {
        const date = session.start_time.split('T')[0];
        if (!sessionsByDate[date]) {
          sessionsByDate[date] = [];
        }
        sessionsByDate[date].push(session);
      });

      // Helper function to group sessions by task
      const groupByTask = (daySessions: any[]): TaskGroup[] => {
        const groupMap = new Map<string, TaskGroup>();

        for (const session of daySessions) {
          const existing = groupMap.get(session.issue_key);
          if (existing) {
            existing.sessions.push(session);
            existing.totalSeconds += session.duration_seconds;
          } else {
            groupMap.set(session.issue_key, {
              issueKey: session.issue_key,
              issueTitle: session.issue_title,
              issueType: session.issue_type,
              sessions: [session],
              totalSeconds: session.duration_seconds,
            });
          }
        }

        // Sort by total time descending
        return Array.from(groupMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
      };

      // Create day data for each date with sessions
      const days: DayData[] = [];
      const allDates = new Set([
        ...Object.keys(sessionsByDate),
        ...summaries.map((s: any) => s.date)
      ]);

      allDates.forEach(date => {
        const daySessions = sessionsByDate[date] || [];
        const summary = summaries.find((s: any) => s.date === date);
        const totalMinutes = daySessions.reduce(
          (sum: number, s: any) => sum + s.duration_seconds / 60,
          0
        );
        const taskGroups = groupByTask(daySessions);

        // Determine status
        let status: DayData['status'] = 'draft';
        if (summary?.status === 'sent') {
          status = 'sent';
        } else if (summary?.status === 'ready') {
          status = 'ready';
        } else if (daySessions.length > 0) {
          status = 'pending';
        }

        if (daySessions.length > 0 || summary) {
          days.push({
            date,
            sessions: daySessions,
            taskGroups,
            totalMinutes: summary?.adjusted_minutes || totalMinutes,
            status,
            summary
          });
        }
      });

      // Sort by date descending (most recent first)
      days.sort((a, b) => b.date.localeCompare(a.date));

      setDaysData(days);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const analyzeAdjustments = async () => {
    try {
      const adj = await window.electronAPI.adjustments.analyze();
      setAdjustments(adj);
    } catch (err: any) {
      console.error('Error analyzing adjustments:', err);
    }
  };

  const toggleDateDetails = (date: string) => {
    setSelectedDate(selectedDate === date ? null : date);
  };

  const applyAdjustments = async () => {
    try {
      setLoading(true);
      await window.electronAPI.adjustments.apply(adjustments);
      await loadRecentDays();
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'application des ajustements');
    } finally {
      setLoading(false);
    }
  };

  const sendToTempo = async (date: string) => {
    try {
      setLoading(true);
      const results = await window.electronAPI.tempo.sendDay(date);

      const failures = results.filter((r: any) => !r.success);
      const successes = results.filter((r: any) => r.success);

      if (failures.length > 0) {
        // Build detailed error message
        const errorDetails = failures.map((f: any) => `${f.session}: ${f.error}`).join('\n');
        setError(`Erreur pour ${failures.length} tâche(s):\n${errorDetails}`);
        console.error('Tempo send failures:', failures);

        if (successes.length > 0) {
          alert(`${successes.length} tâche(s) envoyée(s) avec succès.\n${failures.length} tâche(s) ont échoué.`);
        }
      } else if (successes.length > 0) {
        setError('');
        alert(`Journée du ${date} envoyée avec succès à Tempo! (${successes.length} tâche(s))`);
      } else {
        setError('Aucune tâche à envoyer');
      }

      await loadRecentDays();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi à Tempo');
    } finally {
      setLoading(false);
    }
  };

  const adjustDay = async (date: string) => {
    try {
      setLoading(true);
      await window.electronAPI.adjustments.applyDay(date);
      await loadRecentDays();
      await analyzeAdjustments();
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajustement');
    } finally {
      setLoading(false);
    }
  };

  const isToday = (dateStr: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${dayName} ${day}/${month}`;
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      'pending': 'Brouillon',
      'ready': 'Prêt',
      'sent': 'Envoyé',
    };
    return statusMap[status] || status;
  };

  const needsAdjustment = (date: string): boolean => {
    return adjustments.some(adj => adj.date === date && adj.needsAdjustment);
  };

  return (
    <div className="timesheet-view">
      <div className="timesheet-header">
        <h2>Feuilles de temps</h2>
        <div className="header-actions">
          <button
            className="refresh-button"
            onClick={loadRecentDays}
            disabled={loading}
          >
            Actualiser
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="summaries-list">
        {daysData.map((day) => (
          <div key={day.date} className={`summary-card ${isToday(day.date) ? 'today' : ''}`}>
            <div className="summary-header" onClick={() => toggleDateDetails(day.date)}>
              <div className="summary-date">
                {isToday(day.date) && <span className="today-badge">Aujourd'hui</span>}
                {formatDate(day.date)}
              </div>
              <div className="summary-time">
                {formatMinutes(day.totalMinutes)}
                {needsAdjustment(day.date) && (
                  <span className="adjustment-badge">✓ À ajuster</span>
                )}
              </div>
              <div className="summary-status">
                <span className={`status-badge status-${day.status}`}>
                  {getStatusLabel(day.status)}
                </span>
              </div>
              <div className="expand-icon">
                {selectedDate === day.date ? '▼' : '▶'}
              </div>
            </div>

            {day.status !== 'sent' && (
              <div className="summary-actions">
                <button
                  className="adjust-day-button"
                  onClick={(e) => { e.stopPropagation(); adjustDay(day.date); }}
                  disabled={loading || day.sessions.length === 0}
                  title={`Ajuster à ${maxDailyHours}h`}
                >
                  Ajuster à {maxDailyHours}h
                </button>
                <button
                  className="send-button"
                  onClick={(e) => { e.stopPropagation(); sendToTempo(day.date); }}
                  disabled={loading || day.sessions.length === 0}
                >
                  Envoyer à Tempo
                </button>
              </div>
            )}

            {selectedDate === day.date && (
              <div className="sessions-detail">
                <h4>Tâches ({day.taskGroups.length})</h4>
                {day.taskGroups.length === 0 ? (
                  <p className="no-sessions">Aucune session enregistrée</p>
                ) : (
                  day.taskGroups.map((group) => {
                    const adjustment = adjustments.find(a => a.date === day.date);
                    const adjustedGroup = adjustment?.taskGroups?.find(
                      (g: any) => g.issueKey === group.issueKey
                    );
                    const adjustedSeconds = adjustedGroup?.adjustedTotalSeconds;
                    const wasAdjusted = adjustedGroup?.wasAdjusted;

                    return (
                      <div key={group.issueKey} className="task-group-item">
                        <div className="task-group-info">
                          <span className="issue-key">{group.issueKey}</span>
                          <span className="issue-title">{group.issueTitle}</span>
                          <span className="session-count">
                            ({group.sessions.length} session{group.sessions.length > 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="task-group-time">
                          {wasAdjusted && adjustedSeconds ? (
                            <>
                              <span className="original-time">{formatMinutes(group.totalSeconds / 60)}</span>
                              <span className="arrow">→</span>
                              <span className="adjusted-time">{formatMinutes(adjustedSeconds / 60)}</span>
                            </>
                          ) : (
                            <span>{formatMinutes(group.totalSeconds / 60)}</span>
                          )}
                        </div>
                        <div className="task-group-status">
                          {wasAdjusted && (
                            <span className="adjusted-badge">Ajusté</span>
                          )}
                          {day.status === 'sent' && (
                            <span className="sent-badge">Envoyé</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {daysData.length === 0 && !loading && (
        <div className="empty-state">
          <p>Aucune feuille de temps sur les 14 derniers jours</p>
          <p className="hint">Démarrez un chronomètre pour créer votre première entrée</p>
        </div>
      )}
    </div>
  );
}

export default TimesheetView;
