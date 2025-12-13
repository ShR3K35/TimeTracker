import React, { useState, useEffect } from 'react';
import './TimerView.css';

interface TimerViewProps {
  timerState: any;
  onChangeTask: () => void;
}

function TimerView({ timerState, onChangeTask }: TimerViewProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentSession, setCurrentSession] = useState<any>(null);

  useEffect(() => {
    if (timerState) {
      setElapsedSeconds(timerState.elapsedSeconds);
      setCurrentSession(timerState.currentSession);
    }

    // Listen for timer ticks
    window.electronAPI.timer.onTick((seconds) => {
      setElapsedSeconds(seconds);
    });
  }, [timerState]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    await window.electronAPI.timer.stop();
  };

  if (!currentSession) {
    return (
      <div className="timer-view empty">
        <div className="empty-state">
          <h2>Aucune tâche active</h2>
          <p>Sélectionnez une tâche pour commencer à tracker votre temps</p>
          <button className="primary-button" onClick={onChangeTask}>
            Sélectionner une tâche
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="timer-view">
      <div className="current-task">
        <div className="task-icon">▶</div>
        <div className="task-info">
          <div className="task-key">{currentSession.issue_key}</div>
          <div className="task-title">{currentSession.issue_title}</div>
          <div className="task-type">{currentSession.issue_type}</div>
        </div>
      </div>

      <div className="timer-display">
        <div className="time">{formatTime(elapsedSeconds)}</div>
      </div>

      <div className="timer-actions">
        <button className="change-button" onClick={onChangeTask}>
          Changer de tâche
        </button>
        <button className="stop-button" onClick={handleStop}>
          Arrêter
        </button>
      </div>

      <div className="timer-info">
        <p>Le chronomètre est actif. Vous recevrez une notification toutes les heures pour confirmer que vous travaillez toujours sur cette tâche.</p>
      </div>
    </div>
  );
}

export default TimerView;
