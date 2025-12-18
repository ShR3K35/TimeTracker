import React, { useState, useEffect } from 'react';
import './TaskSelector.css';

interface TaskSelectorProps {
  onTaskSelected: (issue: any, activityId?: number, activityName?: string, activityValue?: string) => void;
}

interface TempoActivity {
  id: number;
  tempo_id: number;
  name: string;
  value: string;
  position: number;
}

function TaskSelector({ onTaskSelected }: TaskSelectorProps) {
  const [searchText, setSearchText] = useState('');
  const [recentIssues, setRecentIssues] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [favoriteIssues, setFavoriteIssues] = useState<any[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState<TempoActivity[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);

  useEffect(() => {
    loadRecentIssues();
    loadFavorites();
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const acts = await window.electronAPI.activities.get();
      setActivities(acts);
      // Set default activity if available
      if (acts.length > 0) {
        setSelectedActivityId(acts[0].tempo_id);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

  const loadFavorites = async () => {
    try {
      const favorites = await window.electronAPI.favorites.get();
      const favoriteIssues = favorites.map((fav: any) => ({
        key: fav.issue_key,
        fields: {
          summary: fav.issue_title,
          issuetype: { name: fav.issue_type },
        },
      }));
      setFavoriteIssues(favoriteIssues);
      setFavoriteKeys(new Set(favorites.map((f: any) => f.issue_key)));
    } catch (err) {
      console.error('Error loading favorites:', err);
    }
  };

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

  const toggleFavorite = async (e: React.MouseEvent, issue: any) => {
    e.stopPropagation(); // Prevent triggering task selection

    const issueKey = issue.key;
    const isFavorite = favoriteKeys.has(issueKey);

    try {
      if (isFavorite) {
        // Remove from favorites
        await window.electronAPI.favorites.remove(issueKey);
        setFavoriteKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(issueKey);
          return newSet;
        });
        setFavoriteIssues(prev => prev.filter(f => f.key !== issueKey));
      } else {
        // Add to favorites
        const favorites = await window.electronAPI.favorites.get();
        if (favorites.length >= 10) {
          setError('Maximum de 10 tâches favorites atteint');
          setTimeout(() => setError(''), 3000);
          return;
        }

        const result = await window.electronAPI.favorites.add({
          issueKey: issue.key,
          issueTitle: issue.fields.summary,
          issueType: issue.fields.issuetype.name,
          position: favorites.length,
        });

        if (result.success) {
          setFavoriteKeys(prev => new Set(prev).add(issueKey));
          await loadFavorites();
        } else {
          setError(result.error || 'Erreur lors de l\'ajout aux favoris');
          setTimeout(() => setError(''), 3000);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification des favoris');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleIssueClick = (issue: any) => {
    if (activities.length > 0) {
      // Show activity selection
      setSelectedIssue(issue);
      setSelectedActivityId(activities[0].tempo_id);
    } else {
      // No activities configured, start timer directly
      onTaskSelected(issue);
    }
  };

  const handleStartWithActivity = () => {
    if (!selectedIssue) return;

    const activity = activities.find(a => a.tempo_id === selectedActivityId);
    onTaskSelected(selectedIssue, selectedActivityId || undefined, activity?.name, activity?.value);
    setSelectedIssue(null);
  };

  const handleCancelActivitySelection = () => {
    setSelectedIssue(null);
  };

  const renderIssueList = (issues: any[], title: string, showFavoriteButton: boolean = true) => {
    if (issues.length === 0) return null;

    return (
      <div className="issue-section">
        <h3>{title}</h3>
        <div className="issue-list">
          {issues.map((issue) => (
            <div
              key={issue.key}
              className="issue-item"
              onClick={() => handleIssueClick(issue)}
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
                {showFavoriteButton && (
                  <button
                    className="favorite-button"
                    onClick={(e) => toggleFavorite(e, issue)}
                    title={favoriteKeys.has(issue.key) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    {favoriteKeys.has(issue.key) ? '★' : '☆'}
                  </button>
                )}
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

      {/* Always show favorites at the top if not searching */}
      {!searchText && favoriteIssues.length > 0 && renderIssueList(favoriteIssues, '⭐ Tâches favorites', false)}

      {searchResults.length > 0 ? (
        renderIssueList(searchResults, 'Résultats de recherche')
      ) : (
        !searchText && renderIssueList(recentIssues, 'Tâches récentes')
      )}

      {!loading && searchResults.length === 0 && searchText && (
        <div className="no-results">
          <p>Aucune tâche trouvée pour "{searchText}"</p>
        </div>
      )}

      {/* Activity Selection Modal */}
      {selectedIssue && (
        <div className="activity-modal-overlay" onClick={handleCancelActivitySelection}>
          <div className="activity-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Démarrer le chronomètre</h3>
            <div className="selected-task-info">
              <span className="selected-task-key">{selectedIssue.key}</span>
              <span className="selected-task-title">{selectedIssue.fields.summary}</span>
            </div>

            <div className="activity-selection">
              <label>Activité :</label>
              <div className="activity-buttons">
                {activities.map((activity) => (
                  <button
                    key={activity.tempo_id}
                    className={`activity-button ${selectedActivityId === activity.tempo_id ? 'selected' : ''}`}
                    onClick={() => setSelectedActivityId(activity.tempo_id)}
                  >
                    {activity.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="activity-modal-actions">
              <button className="cancel-button" onClick={handleCancelActivitySelection}>
                Annuler
              </button>
              <button className="start-button" onClick={handleStartWithActivity}>
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskSelector;
