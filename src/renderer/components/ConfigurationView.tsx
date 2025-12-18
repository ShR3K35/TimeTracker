import React, { useState, useEffect } from 'react';
import './ConfigurationView.css';

interface ConfigurationViewProps {
  onConfigured: () => void;
}

function ConfigurationView({ onConfigured }: ConfigurationViewProps) {
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [tempoApiUrl, setTempoApiUrl] = useState('https://api.tempo.io/4');
  const [tempoToken, setTempoToken] = useState('');
  const [tempoAccountId, setTempoAccountId] = useState('');
  const [notificationInterval, setNotificationInterval] = useState('60');
  const [maxDailyHours, setMaxDailyHours] = useState('7.5');
  const [jiraProjectKey, setJiraProjectKey] = useState('TGD');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    const jiraUrl = await window.electronAPI.config.get('jira_base_url');
    const email = await window.electronAPI.config.get('jira_email');
    const tempoUrl = await window.electronAPI.config.get('tempo_api_url');
    const accountId = await window.electronAPI.config.get('tempo_account_id');
    const notifInterval = await window.electronAPI.config.get('notification_interval');
    const maxHours = await window.electronAPI.config.get('max_daily_hours');
    const projectKey = await window.electronAPI.config.get('jira_project_key');

    if (jiraUrl) setJiraBaseUrl(jiraUrl);
    if (email) setJiraEmail(email);
    if (tempoUrl) setTempoApiUrl(tempoUrl);
    if (accountId) setTempoAccountId(accountId);
    if (notifInterval) setNotificationInterval(notifInterval);
    if (maxHours) setMaxDailyHours(maxHours);
    if (projectKey) setJiraProjectKey(projectKey);
  };

  const saveGeneralSettings = async () => {
    await window.electronAPI.config.set('notification_interval', notificationInterval);
    await window.electronAPI.config.set('max_daily_hours', maxDailyHours);
    await window.electronAPI.config.set('jira_project_key', jiraProjectKey);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await window.electronAPI.config.initializeServices({
        jiraBaseUrl,
        jiraEmail,
        jiraToken,
        tempoApiUrl,
        tempoToken,
        tempoAccountId,
      });

      if (result.success) {
        onConfigured();
      } else {
        setError(result.error || 'Erreur de configuration');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="configuration-view">
      <h2>Paramètres</h2>

      <div className="form-section general-settings">
        <h3>Paramètres généraux</h3>
        <div className="form-group">
          <label htmlFor="jiraProjectKey">Clé du projet Jira</label>
          <input
            id="jiraProjectKey"
            type="text"
            value={jiraProjectKey}
            onChange={(e) => setJiraProjectKey(e.target.value)}
            placeholder="TGD"
          />
          <small>Préfixe des tickets Jira (ex: TGD, PROJ)</small>
        </div>
        <div className="form-group">
          <label htmlFor="notificationInterval">Intervalle de rappel (minutes)</label>
          <input
            id="notificationInterval"
            type="number"
            min="5"
            max="480"
            value={notificationInterval}
            onChange={(e) => setNotificationInterval(e.target.value)}
          />
          <small>Temps avant de demander si vous travaillez toujours sur la même tâche</small>
        </div>
        <div className="form-group">
          <label htmlFor="maxDailyHours">Heures max par jour</label>
          <input
            id="maxDailyHours"
            type="number"
            step="0.5"
            min="1"
            max="24"
            value={maxDailyHours}
            onChange={(e) => setMaxDailyHours(e.target.value)}
          />
          <small>Limite quotidienne pour les ajustements automatiques</small>
        </div>
        <button type="button" onClick={saveGeneralSettings} className="save-settings-button">
          Sauvegarder les paramètres
        </button>
        {settingsSaved && <span className="settings-saved">Paramètres sauvegardés !</span>}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Connexion Jira</h3>
          <div className="form-group">
            <label htmlFor="jiraBaseUrl">URL de base Jira</label>
            <input
              id="jiraBaseUrl"
              type="url"
              value={jiraBaseUrl}
              onChange={(e) => setJiraBaseUrl(e.target.value)}
              placeholder="https://your-domain.atlassian.net"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="jiraEmail">Email</label>
            <input
              id="jiraEmail"
              type="email"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
              placeholder="votre.email@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="jiraToken">API Token</label>
            <input
              id="jiraToken"
              type="password"
              value={jiraToken}
              onChange={(e) => setJiraToken(e.target.value)}
              placeholder="Votre token API Jira"
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Tempo</h3>
          <div className="form-group">
            <label htmlFor="tempoApiUrl">URL API Tempo</label>
            <input
              id="tempoApiUrl"
              type="url"
              value={tempoApiUrl}
              onChange={(e) => setTempoApiUrl(e.target.value)}
              placeholder="https://api.tempo.io/4"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="tempoToken">API Token Tempo</label>
            <input
              id="tempoToken"
              type="password"
              value={tempoToken}
              onChange={(e) => setTempoToken(e.target.value)}
              placeholder="Votre token API Tempo"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="tempoAccountId">Account ID</label>
            <input
              id="tempoAccountId"
              type="text"
              value={tempoAccountId}
              onChange={(e) => setTempoAccountId(e.target.value)}
              placeholder="Votre Account ID Tempo"
              required
            />
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Vérification...' : 'Sauvegarder et connecter'}
        </button>
      </form>

      <div className="help-text">
        <h4>Comment obtenir vos tokens ?</h4>
        <ul>
          <li>
            <strong>Jira API Token:</strong> Allez sur{' '}
            <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
              Atlassian Account Security
            </a>
          </li>
          <li>
            <strong>Tempo API Token:</strong> Dans Tempo, allez dans Settings → API Integration
          </li>
          <li>
            <strong>Account ID:</strong> Trouvable dans votre profil Tempo ou Jira
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ConfigurationView;
