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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    const jiraUrl = await window.electronAPI.config.get('jira_base_url');
    const email = await window.electronAPI.config.get('jira_email');
    const tempoUrl = await window.electronAPI.config.get('tempo_api_url');
    const accountId = await window.electronAPI.config.get('tempo_account_id');

    if (jiraUrl) setJiraBaseUrl(jiraUrl);
    if (email) setJiraEmail(email);
    if (tempoUrl) setTempoApiUrl(tempoUrl);
    if (accountId) setTempoAccountId(accountId);
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
      <h2>Configuration</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Jira</h3>
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
