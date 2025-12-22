import React, { useState, useEffect } from 'react';
import './TimesheetView.css';

interface TempoActivity {
  id: number;
  tempo_id: number;
  name: string;
  value: string;
  order_index: number;
}

interface TaskGroup {
  issueKey: string;
  issueTitle: string;
  issueType: string;
  activityId: number | null;
  activityName: string | null;
  sessions: any[];
  totalSeconds: number;
  adjustedSeconds?: number;
  groupKey: string;
}

interface EditingTask {
  date: string;
  groupKey: string;
  hours: string;
  minutes: string;
}

interface ManualTaskForm {
  date: string;
  issueKey: string;
  issueTitle: string;
  issueType: string;
  activityId: number | null;
  hours: string;
  minutes: string;
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
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [activities, setActivities] = useState<TempoActivity[]>([]);
  const [editingActivity, setEditingActivity] = useState<{ date: string; groupKey: string } | null>(null);
  const [manualTaskForm, setManualTaskForm] = useState<ManualTaskForm | null>(null);
  const [issueSearchText, setIssueSearchText] = useState('');
  const [issueSearchResults, setIssueSearchResults] = useState<any[]>([]);
  const [searchingIssues, setSearchingIssues] = useState(false);
  const [showNewDayPicker, setShowNewDayPicker] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');

  useEffect(() => {
    loadRecentDays();
    analyzeAdjustments();
    loadMaxDailyHours();
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const acts = await window.electronAPI.activities.get();
      setActivities(acts);
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

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

      // Helper function to group sessions by task AND activity
      const groupByTaskAndActivity = (daySessions: any[]): TaskGroup[] => {
        const groupMap = new Map<string, TaskGroup>();

        for (const session of daySessions) {
          // Group key includes both issue_key and activity_id
          const groupKey = `${session.issue_key}|${session.activity_id || 'none'}`;
          const existing = groupMap.get(groupKey);

          if (existing) {
            existing.sessions.push(session);
            existing.totalSeconds += session.duration_seconds;
          } else {
            groupMap.set(groupKey, {
              issueKey: session.issue_key,
              issueTitle: session.issue_title,
              issueType: session.issue_type,
              activityId: session.activity_id,
              activityName: session.activity_name,
              sessions: [session],
              totalSeconds: session.duration_seconds,
              groupKey: groupKey,
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
        const taskGroups = groupByTaskAndActivity(daySessions);

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

  const reopenDay = async (date: string) => {
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir réouvrir la journée du ${formatDate(date)} ?\n\n` +
      `Les worklogs envoyés à Tempo seront supprimés.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await window.electronAPI.adjustments.reopenDay(date);
      await loadRecentDays();
      await analyzeAdjustments();

      if (result.tempoDeleted > 0 || result.tempoFailed > 0) {
        if (result.tempoFailed > 0) {
          setError(`${result.tempoDeleted} worklog(s) supprimé(s) de Tempo, ${result.tempoFailed} échec(s)`);
        } else {
          setError('');
          alert(`${result.tempoDeleted} worklog(s) supprimé(s) de Tempo avec succès`);
        }
      } else {
        setError('');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réouverture');
    } finally {
      setLoading(false);
    }
  };

  const startEditingTask = (date: string, groupKey: string, currentSeconds: number) => {
    const hours = Math.floor(currentSeconds / 3600);
    const minutes = Math.floor((currentSeconds % 3600) / 60);
    setEditingTask({
      date,
      groupKey,
      hours: hours.toString(),
      minutes: minutes.toString().padStart(2, '0'),
    });
  };

  const cancelEditing = () => {
    setEditingTask(null);
  };

  const saveTaskDuration = async () => {
    if (!editingTask) return;

    try {
      setLoading(true);
      const hours = parseInt(editingTask.hours) || 0;
      const minutes = parseInt(editingTask.minutes) || 0;
      const totalSeconds = hours * 3600 + minutes * 60;

      // Parse groupKey to get issueKey and activityId
      const [issueKey, activityPart] = editingTask.groupKey.split('|');
      const activityId = activityPart === 'none' ? null : parseInt(activityPart);

      await window.electronAPI.adjustments.updateTaskDuration(
        editingTask.date,
        issueKey,
        totalSeconds,
        activityId
      );

      setEditingTask(null);
      await loadRecentDays();
      await analyzeAdjustments();
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification');
    } finally {
      setLoading(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTaskDuration();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // Manual task addition
  const openManualTaskForm = (date: string) => {
    setManualTaskForm({
      date,
      issueKey: '',
      issueTitle: '',
      issueType: 'Task',
      activityId: activities.length > 0 ? activities[0].tempo_id : null,
      hours: '0',
      minutes: '30',
    });
    setIssueSearchText('');
    setIssueSearchResults([]);
  };

  const closeManualTaskForm = () => {
    setManualTaskForm(null);
    setIssueSearchText('');
    setIssueSearchResults([]);
  };

  const searchIssues = async () => {
    if (!issueSearchText.trim()) {
      setIssueSearchResults([]);
      return;
    }

    try {
      setSearchingIssues(true);
      const results = await window.electronAPI.jira.searchIssues(issueSearchText);
      setIssueSearchResults(results);
    } catch (err: any) {
      console.error('Error searching issues:', err);
      setError(err.message || 'Erreur lors de la recherche');
    } finally {
      setSearchingIssues(false);
    }
  };

  const selectIssueForManualTask = (issue: any) => {
    if (!manualTaskForm) return;
    setManualTaskForm({
      ...manualTaskForm,
      issueKey: issue.key,
      issueTitle: issue.fields.summary,
      issueType: issue.fields.issuetype.name,
    });
    setIssueSearchText('');
    setIssueSearchResults([]);
  };

  const saveManualTask = async () => {
    if (!manualTaskForm || !manualTaskForm.issueKey) {
      setError('Veuillez sélectionner une tâche');
      return;
    }

    try {
      setLoading(true);
      const hours = parseInt(manualTaskForm.hours) || 0;
      const minutes = parseInt(manualTaskForm.minutes) || 0;
      const totalSeconds = hours * 3600 + minutes * 60;

      if (totalSeconds === 0) {
        setError('La durée doit être supérieure à 0');
        setLoading(false);
        return;
      }

      const activity = activities.find(a => a.tempo_id === manualTaskForm.activityId);

      await window.electronAPI.sessions.createManual({
        date: manualTaskForm.date,
        issueKey: manualTaskForm.issueKey,
        issueTitle: manualTaskForm.issueTitle,
        issueType: manualTaskForm.issueType,
        durationSeconds: totalSeconds,
        activityId: manualTaskForm.activityId,
        activityName: activity?.name || null,
        activityValue: activity?.value || null,
      });

      closeManualTaskForm();
      await loadRecentDays();
      await analyzeAdjustments();
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout de la tâche');
    } finally {
      setLoading(false);
    }
  };

  const updateGroupActivity = async (date: string, groupKey: string, newActivityId: number | null, newActivityName: string | null, newActivityValue: string | null) => {
    try {
      setLoading(true);

      // Parse groupKey to get issueKey and old activityId
      const [issueKey, activityPart] = groupKey.split('|');
      const oldActivityId = activityPart === 'none' ? null : parseInt(activityPart);

      await window.electronAPI.sessions.updateGroupActivity(
        date,
        issueKey,
        oldActivityId,
        newActivityId,
        newActivityName,
        newActivityValue
      );

      setEditingActivity(null);
      await loadRecentDays();
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification de l\'activité');
    } finally {
      setLoading(false);
    }
  };

  const deleteTaskGroup = async (date: string, groupKey: string, issueKey: string) => {
    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer toutes les sessions de ${issueKey} pour cette journée ?`);
    if (!confirmed) return;

    try {
      setLoading(true);

      // Parse groupKey to get activityId
      const [, activityPart] = groupKey.split('|');
      const activityId = activityPart === 'none' ? null : parseInt(activityPart);

      await window.electronAPI.sessions.deleteGroup(date, issueKey, activityId);

      await loadRecentDays();
      await analyzeAdjustments();
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const openNewDayPicker = () => {
    // Default to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setNewDayDate(yesterday.toISOString().split('T')[0]);
    setShowNewDayPicker(true);
  };

  const createNewDay = () => {
    if (!newDayDate) return;

    // Check if day already exists
    const existingDay = daysData.find(d => d.date === newDayDate);
    if (existingDay) {
      setError('Cette journée existe déjà');
      return;
    }

    // Open manual task form for this date directly
    setShowNewDayPicker(false);
    openManualTaskForm(newDayDate);
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
            className="new-day-button"
            onClick={openNewDayPicker}
            disabled={loading}
          >
            + Nouvelle journée
          </button>
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

            <div className="summary-actions">
              {day.status !== 'sent' ? (
                <>
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
                </>
              ) : (
                <button
                  className="reopen-button"
                  onClick={(e) => { e.stopPropagation(); reopenDay(day.date); }}
                  disabled={loading}
                  title="Réouvrir pour modifier"
                >
                  Réouvrir
                </button>
              )}
            </div>

            {selectedDate === day.date && (
              <div className="sessions-detail">
                <div className="sessions-detail-header">
                  <h4>Tâches ({day.taskGroups.length})</h4>
                  {day.status !== 'sent' && (
                    <button
                      className="add-task-button"
                      onClick={(e) => { e.stopPropagation(); openManualTaskForm(day.date); }}
                      disabled={loading}
                    >
                      + Ajouter une tâche
                    </button>
                  )}
                </div>
                {day.taskGroups.length === 0 ? (
                  <p className="no-sessions">Aucune session enregistrée</p>
                ) : (
                  day.taskGroups.map((group) => {
                    const adjustment = adjustments.find(a => a.date === day.date);
                    const adjustedGroup = adjustment?.taskGroups?.find(
                      (g: any) => g.issueKey === group.issueKey && g.activityId === group.activityId
                    );
                    const adjustedSeconds = adjustedGroup?.adjustedTotalSeconds;
                    const wasAdjusted = adjustedGroup?.wasAdjusted;
                    const isEditing = editingTask?.date === day.date && editingTask?.groupKey === group.groupKey;
                    const isEditingAct = editingActivity?.date === day.date && editingActivity?.groupKey === group.groupKey;
                    const canEdit = day.status !== 'sent';

                    return (
                      <div key={group.groupKey} className="task-group-item">
                        <div className="task-group-info">
                          <span className="issue-key">{group.issueKey}</span>
                          <span className="issue-title">{group.issueTitle}</span>
                          <div className="task-group-activity">
                            {isEditingAct ? (
                              <select
                                className="activity-select"
                                value={group.activityId || ''}
                                onChange={(e) => {
                                  const selectedId = e.target.value ? parseInt(e.target.value) : null;
                                  const selectedActivity = activities.find(a => a.tempo_id === selectedId);
                                  updateGroupActivity(
                                    day.date,
                                    group.groupKey,
                                    selectedId,
                                    selectedActivity?.name || null,
                                    selectedActivity?.value || null
                                  );
                                }}
                                onBlur={() => setEditingActivity(null)}
                                autoFocus
                              >
                                <option value="">Sans activité</option>
                                {activities.map((act) => (
                                  <option key={act.tempo_id} value={act.tempo_id}>
                                    {act.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <>
                                <span className={`activity-badge ${group.activityId ? 'has-activity' : 'no-activity'}`}>
                                  {group.activityName || 'Sans activité'}
                                </span>
                                {canEdit && activities.length > 0 && (
                                  <button
                                    className="edit-activity-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingActivity({ date: day.date, groupKey: group.groupKey });
                                    }}
                                    title="Modifier l'activité"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          <span className="session-count">
                            ({group.sessions.length} session{group.sessions.length > 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="task-group-time">
                          {isEditing ? (
                            <div className="edit-duration">
                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={editingTask.hours}
                                onChange={(e) => setEditingTask({ ...editingTask, hours: e.target.value })}
                                onKeyDown={handleEditKeyDown}
                                className="duration-input"
                                autoFocus
                              />
                              <span>h</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={editingTask.minutes}
                                onChange={(e) => setEditingTask({ ...editingTask, minutes: e.target.value })}
                                onKeyDown={handleEditKeyDown}
                                className="duration-input"
                              />
                              <span>min</span>
                              <button className="save-edit-button" onClick={saveTaskDuration} disabled={loading}>
                                ✓
                              </button>
                              <button className="cancel-edit-button" onClick={cancelEditing}>
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              {wasAdjusted && adjustedSeconds ? (
                                <>
                                  <span className="original-time">{formatMinutes(group.totalSeconds / 60)}</span>
                                  <span className="arrow">→</span>
                                  <span className="adjusted-time">{formatMinutes(adjustedSeconds / 60)}</span>
                                </>
                              ) : (
                                <span>{formatMinutes(group.totalSeconds / 60)}</span>
                              )}
                              {canEdit && (
                                <button
                                  className="edit-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingTask(day.date, group.groupKey, group.totalSeconds);
                                  }}
                                  title="Modifier la durée"
                                >
                                  ✏️
                                </button>
                              )}
                            </>
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
                        {canEdit && (
                          <button
                            className="delete-group-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTaskGroup(day.date, group.groupKey, group.issueKey);
                            }}
                            title="Supprimer ce groupe de tâches"
                            disabled={loading}
                          >
                            🗑️
                          </button>
                        )}
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

      {/* Manual Task Addition Modal */}
      {manualTaskForm && (
        <div className="manual-task-modal-overlay" onClick={closeManualTaskForm}>
          <div className="manual-task-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ajouter une tâche manuellement</h3>
            <p className="modal-date">Date: {formatDate(manualTaskForm.date)}</p>

            {/* Issue Search */}
            <div className="form-group">
              <label>Tâche Jira</label>
              {manualTaskForm.issueKey ? (
                <div className="selected-issue">
                  <span className="selected-issue-key">{manualTaskForm.issueKey}</span>
                  <span className="selected-issue-title">{manualTaskForm.issueTitle}</span>
                  <button
                    className="change-issue-button"
                    onClick={() => setManualTaskForm({ ...manualTaskForm, issueKey: '', issueTitle: '', issueType: 'Task' })}
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <div className="issue-search">
                  <div className="issue-search-input-row">
                    <input
                      type="text"
                      placeholder="Rechercher (ex: TGD-123 ou mot-clé)..."
                      value={issueSearchText}
                      onChange={(e) => setIssueSearchText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchIssues()}
                    />
                    <button onClick={searchIssues} disabled={searchingIssues}>
                      {searchingIssues ? '...' : 'Rechercher'}
                    </button>
                  </div>
                  {issueSearchResults.length > 0 && (
                    <div className="issue-search-results">
                      {issueSearchResults.map((issue) => (
                        <div
                          key={issue.key}
                          className="issue-search-result-item"
                          onClick={() => selectIssueForManualTask(issue)}
                        >
                          <span className="result-key">{issue.key}</span>
                          <span className="result-title">{issue.fields.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Activity Selection */}
            {activities.length > 0 && (
              <div className="form-group">
                <label>Activité</label>
                <select
                  value={manualTaskForm.activityId || ''}
                  onChange={(e) => setManualTaskForm({
                    ...manualTaskForm,
                    activityId: e.target.value ? parseInt(e.target.value) : null
                  })}
                >
                  <option value="">Sans activité</option>
                  {activities.map((act) => (
                    <option key={act.tempo_id} value={act.tempo_id}>
                      {act.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Duration */}
            <div className="form-group">
              <label>Durée</label>
              <div className="duration-inputs">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={manualTaskForm.hours}
                  onChange={(e) => setManualTaskForm({ ...manualTaskForm, hours: e.target.value })}
                />
                <span>h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={manualTaskForm.minutes}
                  onChange={(e) => setManualTaskForm({ ...manualTaskForm, minutes: e.target.value })}
                />
                <span>min</span>
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button className="cancel-button" onClick={closeManualTaskForm}>
                Annuler
              </button>
              <button
                className="save-button"
                onClick={saveManualTask}
                disabled={loading || !manualTaskForm.issueKey}
              >
                {loading ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Day Picker Modal */}
      {showNewDayPicker && (
        <div className="manual-task-modal-overlay" onClick={() => setShowNewDayPicker(false)}>
          <div className="manual-task-modal new-day-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nouvelle feuille de temps</h3>
            <p className="modal-description">Sélectionnez une date pour créer une nouvelle feuille de temps</p>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowNewDayPicker(false)}>
                Annuler
              </button>
              <button
                className="save-button"
                onClick={createNewDay}
                disabled={!newDayDate}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimesheetView;
