import React, { useState, useEffect } from 'react';
import './TimesheetView.css';

function TimesheetView() {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPendingSummaries();
    analyzeAdjustments();
  }, []);

  const loadPendingSummaries = async () => {
    try {
      setLoading(true);
      const pending = await window.electronAPI.summaries.getPending();
      setSummaries(pending);
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

  const loadSessionsForDate = async (date: string) => {
    try {
      setLoading(true);
      const daySessions = await window.electronAPI.sessions.getByDate(date);
      setSessions(daySessions);
      setSelectedDate(date);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des sessions');
    } finally {
      setLoading(false);
    }
  };

  const applyAdjustments = async () => {
    try {
      setLoading(true);
      await window.electronAPI.adjustments.apply(adjustments);
      await loadPendingSummaries();
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
      if (failures.length > 0) {
        setError(`Erreur pour certaines tâches: ${failures.map((f: any) => f.session).join(', ')}`);
      } else {
        setError('');
        alert(`Journée du ${date} envoyée avec succès à Tempo!`);
      }

      await loadPendingSummaries();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi à Tempo');
    } finally {
      setLoading(false);
    }
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
        {adjustments.some(a => a.needsAdjustment) && (
          <button
            className="adjustment-button"
            onClick={applyAdjustments}
            disabled={loading}
          >
            Appliquer les ajustements automatiques
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="summaries-list">
        {summaries.map((summary) => (
          <div key={summary.id} className="summary-card">
            <div className="summary-header">
              <div className="summary-date">
                {formatDate(summary.date)}
              </div>
              <div className="summary-time">
                {formatMinutes(summary.adjusted_minutes || summary.total_minutes)}
                {needsAdjustment(summary.date) && (
                  <span className="adjustment-badge">✓ À ajuster</span>
                )}
              </div>
              <div className="summary-status">
                <span className={`status-badge status-${summary.status}`}>
                  {getStatusLabel(summary.status)}
                </span>
              </div>
            </div>

            <div className="summary-actions">
              <button
                className="detail-button"
                onClick={() => loadSessionsForDate(summary.date)}
              >
                Voir détail
              </button>
              {summary.status !== 'sent' && (
                <button
                  className="send-button"
                  onClick={() => sendToTempo(summary.date)}
                  disabled={loading}
                >
                  Envoyer à Tempo
                </button>
              )}
            </div>

            {selectedDate === summary.date && sessions.length > 0 && (
              <div className="sessions-detail">
                <h4>Sessions de travail</h4>
                {sessions.map((session) => (
                  <div key={session.id} className="session-item">
                    <div className="session-task">
                      {session.issue_key} - {session.issue_title}
                    </div>
                    <div className="session-time">
                      {formatMinutes(session.duration_seconds / 60)}
                    </div>
                    <div className="session-status">
                      {session.status === 'adjusted' && (
                        <span className="adjusted-badge">Ajusté</span>
                      )}
                      {session.status === 'sent' && (
                        <span className="sent-badge">Envoyé</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {summaries.length === 0 && !loading && (
        <div className="empty-state">
          <p>Aucune feuille de temps en attente</p>
        </div>
      )}

      {adjustments.some(a => a.needsAdjustment) && (
        <div className="adjustment-info">
          <h3>Ajustements nécessaires</h3>
          <p>
            Les journées suivantes dépassent 7h30 et seront ajustées automatiquement :
          </p>
          <ul>
            {adjustments
              .filter(a => a.needsAdjustment)
              .map(adj => (
                <li key={adj.date}>
                  {formatDate(adj.date)} : {formatMinutes(adj.originalTotalMinutes)} → {formatMinutes(adj.adjustedTotalMinutes)}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TimesheetView;
