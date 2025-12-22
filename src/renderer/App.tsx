import React, { useState, useEffect } from 'react';
import './App.css';
import ConfigurationView from './components/ConfigurationView';
import TimerView from './components/TimerView';
import TaskSelector from './components/TaskSelector';
import TimesheetView from './components/TimesheetView';
import ShortcutManager from './components/ShortcutManager';

type View = 'config' | 'timer' | 'tasks' | 'timesheet' | 'shortcuts';

function App() {
  const [currentView, setCurrentView] = useState<View>('config');
  const [isConfigured, setIsConfigured] = useState(false);
  const [timerState, setTimerState] = useState<any>(null);

  useEffect(() => {
    checkConfiguration();
    loadTimerState();

    // Listen for task selector trigger
    window.electronAPI.on.showTaskSelector(() => {
      setCurrentView('tasks');
    });

    // Listen for timer events
    window.electronAPI.timer.onStarted((data) => {
      setCurrentView('timer');
      loadTimerState();
    });

    window.electronAPI.timer.onStopped(() => {
      loadTimerState();
    });
  }, []);

  const checkConfiguration = async () => {
    const jiraUrl = await window.electronAPI.config.get('jira_base_url');
    const tempoUrl = await window.electronAPI.config.get('tempo_api_url');

    if (jiraUrl && tempoUrl) {
      setIsConfigured(true);
      setCurrentView('timer');
    }
  };

  const loadTimerState = async () => {
    const state = await window.electronAPI.timer.getState();
    setTimerState(state);
  };

  const handleConfigured = () => {
    setIsConfigured(true);
    setCurrentView('timer');
  };

  const handleTaskSelected = async (issue: any, activityId?: number, activityName?: string, activityValue?: string, startedAt?: string) => {
    await window.electronAPI.timer.start(issue.key, issue.fields.summary, issue.fields.issuetype.name, activityId, activityName, activityValue, startedAt);
    setCurrentView('timer');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>TGD Time Tracker</h1>
        <nav className="navigation">
          {isConfigured && (
            <>
              <button
                className={currentView === 'timer' ? 'active' : ''}
                onClick={() => setCurrentView('timer')}
              >
                Timer
              </button>
              <button
                className={currentView === 'tasks' ? 'active' : ''}
                onClick={() => setCurrentView('tasks')}
              >
                Tâches
              </button>
              <button
                className={currentView === 'timesheet' ? 'active' : ''}
                onClick={() => setCurrentView('timesheet')}
              >
                Feuilles de temps
              </button>
              <button
                className={currentView === 'shortcuts' ? 'active' : ''}
                onClick={() => setCurrentView('shortcuts')}
              >
                Raccourcis
              </button>
              <button
                className={currentView === 'config' ? 'active' : ''}
                onClick={() => setCurrentView('config')}
              >
                Paramètres
              </button>
            </>
          )}
        </nav>
      </header>

      <main className="app-content">
        {currentView === 'config' && (
          <ConfigurationView onConfigured={handleConfigured} />
        )}
        {currentView === 'timer' && isConfigured && (
          <TimerView
            timerState={timerState}
            onChangeTask={() => setCurrentView('tasks')}
          />
        )}
        {currentView === 'tasks' && isConfigured && (
          <TaskSelector onTaskSelected={handleTaskSelected} />
        )}
        {currentView === 'timesheet' && isConfigured && (
          <TimesheetView />
        )}
        {currentView === 'shortcuts' && isConfigured && (
          <ShortcutManager onClose={() => setCurrentView('timer')} />
        )}
      </main>
    </div>
  );
}

export default App;
