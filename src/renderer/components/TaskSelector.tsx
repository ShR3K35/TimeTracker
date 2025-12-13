import React, { useState, useEffect } from 'react';
import './TaskSelector.css';

interface TaskSelectorProps {
  onTaskSelected: (issue: any) => void;
}

function TaskSelector({ onTaskSelected }: TaskSelectorProps) {
  const [searchText, setSearchText] = useState('');
  const [recentIssues, setRecentIssues] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRecentIssues();
  }, []);

  const loadRecentIssues = async () => {
    try {
      setLoading(true);
      // Try from database first
      const dbRecent = await window.electronAPI.recent.get();
      if (dbRecent.length > 0) {
        setRecentIssues(dbRecent.map((issue: any) => ({
          key: issue.issue_key,
          fields: {
            summary: issue.issue_title,
            issuetype: { name: issue.issue_type },
          },
        })));
      }

      // Then fetch from Jira
      const jiraRecent = await window.electronAPI.jira.getRecentIssues();
      setRecentIssues(jiraRecent);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const results = await window.electronAPI.jira.searchIssues(searchText);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getIssueTypeEmoji = (type: string): string => {
    const typeMap: Record<string, string> = {
      'Epic': '📋',
      'Story': '📖',
      'Task': '📋',
      'Bug': '🐛',
      'Sub-task': '📝',
    };
    return typeMap[type] || '📋';
  };

  const renderIssueList = (issues: any[], title: string) => {
    if (issues.length === 0) return null;

    return (
      <div className="issue-section">
        <h3>{title}</h3>
        <div className="issue-list">
          {issues.map((issue) => (
            <div
              key={issue.key}
              className="issue-item"
              onClick={() => onTaskSelected(issue)}
            >
              <div className="issue-type-icon">
                {getIssueTypeEmoji(issue.fields.issuetype.name)}
              </div>
              <div className="issue-info">
                <div className="issue-key">{issue.key}</div>
                <div className="issue-summary">{issue.fields.summary}</div>
              </div>
              <div className="issue-meta">
                <span className="issue-type-badge">
                  {issue.fields.issuetype.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="task-selector">
      <div className="search-box">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Rechercher une tâche (TGD-1234 ou mots-clés)..."
          className="search-input"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="search-button"
        >
          🔍 {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {searchResults.length > 0 ? (
        renderIssueList(searchResults, 'Résultats de recherche')
      ) : (
        renderIssueList(recentIssues, 'Tâches récentes')
      )}

      {!loading && searchResults.length === 0 && searchText && (
        <div className="no-results">
          <p>Aucune tâche trouvée pour "{searchText}"</p>
        </div>
      )}
    </div>
  );
}

export default TaskSelector;
