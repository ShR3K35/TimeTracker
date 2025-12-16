import React, { useState, useEffect } from 'react';
import './ShortcutManager.css';

interface Shortcut {
  id: number;
  accelerator: string;
  issue_key: string;
  issue_title: string;
  issue_type: string;
  enabled: boolean;
}

interface FavoriteTask {
  id: number;
  issue_key: string;
  issue_title: string;
  issue_type: string;
  position: number;
}

interface ShortcutManagerProps {
  onClose: () => void;
}

function ShortcutManager({ onClose }: ShortcutManagerProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [favorites, setFavorites] = useState<FavoriteTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [newAccelerator, setNewAccelerator] = useState('');
  const [recordingFor, setRecordingFor] = useState<string | null>(null);

  useEffect(() => {
    loadShortcuts();
    loadFavorites();
  }, []);

  const loadShortcuts = async () => {
    try {
      const data = await window.electronAPI.shortcuts.get();
      setShortcuts(data);
    } catch (err: any) {
      setError('Erreur lors du chargement des raccourcis');
    }
  };

  const loadFavorites = async () => {
    try {
      const data = await window.electronAPI.favorites.get();
      setFavorites(data);
    } catch (err: any) {
      setError('Erreur lors du chargement des favoris');
    }
  };

  const handleAddShortcut = async (favorite: FavoriteTask) => {
    if (!newAccelerator.trim()) {
      setError('Veuillez entrer un raccourci');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Validate accelerator
      const validation = await window.electronAPI.shortcuts.validate(newAccelerator);
      if (!validation.isValid) {
        setError('Raccourci invalide. Utilisez le format: Ctrl+F2, Alt+Shift+T, etc.');
        return;
      }

      if (!validation.isAvailable) {
        setError('Ce raccourci est déjà utilisé');
        return;
      }

      const result = await window.electronAPI.shortcuts.add({
        accelerator: newAccelerator,
        issueKey: favorite.issue_key,
        issueTitle: favorite.issue_title,
        issueType: favorite.issue_type,
        enabled: true,
      });

      if (result.success) {
        setSuccess(`Raccourci ${newAccelerator} ajouté pour ${favorite.issue_key}`);
        setNewAccelerator('');
        setEditingShortcut(null);
        await loadShortcuts();
      } else {
        setError(result.error || 'Erreur lors de l\'ajout du raccourci');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout du raccourci');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
    }
  };

  const handleRemoveShortcut = async (accelerator: string) => {
    try {
      setLoading(true);
      await window.electronAPI.shortcuts.remove(accelerator);
      setSuccess('Raccourci supprimé');
      await loadShortcuts();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du raccourci');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
    }
  };

  const handleToggleEnabled = async (accelerator: string, enabled: boolean) => {
    try {
      await window.electronAPI.shortcuts.update(accelerator, { enabled: !enabled });
      await loadShortcuts();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du raccourci');
    }
  };

  const handleKeyCapture = (e: React.KeyboardEvent, favoriteKey: string) => {
    e.preventDefault();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Command');

    // Map key codes to Electron format
    let key = e.key;
    if (key.startsWith('F') && !isNaN(parseInt(key.slice(1)))) {
      // F1-F12 keys
      key = key.toUpperCase();
    } else if (key.length === 1) {
      key = key.toUpperCase();
    } else if (key === ' ') {
      key = 'Space';
    } else if (key === 'ArrowUp') {
      key = 'Up';
    } else if (key === 'ArrowDown') {
      key = 'Down';
    } else if (key === 'ArrowLeft') {
      key = 'Left';
    } else if (key === 'ArrowRight') {
      key = 'Right';
    }

    // Only add key if it's not a modifier
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      parts.push(key);
    }

    if (parts.length > 1) {
      setNewAccelerator(parts.join('+'));
    }
  };

  const getShortcutForFavorite = (issueKey: string): Shortcut | undefined => {
    return shortcuts.find(s => s.issue_key === issueKey);
  };

  return (
    <div className="shortcut-manager">
      <div className="shortcut-header">
        <h2>Configuration des raccourcis clavier</h2>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>

      {error && <div className="message error-message">{error}</div>}
      {success && <div className="message success-message">{success}</div>}

      <div className="shortcut-content">
        <div className="shortcut-info">
          <p>Configurez des raccourcis clavier pour lancer rapidement le chronomètre sur vos tâches favorites.</p>
          <p><strong>Format :</strong> Ctrl+F2, Alt+Shift+T, etc.</p>
        </div>

        {favorites.length === 0 ? (
          <div className="no-favorites">
            <p>Aucune tâche favorite. Ajoutez des tâches favorites pour configurer des raccourcis.</p>
          </div>
        ) : (
          <div className="favorites-list">
            <h3>Tâches favorites ({favorites.length}/10)</h3>
            {favorites.map((favorite) => {
              const shortcut = getShortcutForFavorite(favorite.issue_key);
              const isEditing = editingShortcut === favorite.issue_key;

              return (
                <div key={favorite.id} className="favorite-item">
                  <div className="favorite-info">
                    <div className="favorite-key">{favorite.issue_key}</div>
                    <div className="favorite-title">{favorite.issue_title}</div>
                  </div>

                  <div className="shortcut-controls">
                    {shortcut ? (
                      <>
                        <div className="shortcut-display">
                          <kbd>{shortcut.accelerator}</kbd>
                          <button
                            className={`toggle-button ${shortcut.enabled ? 'enabled' : 'disabled'}`}
                            onClick={() => handleToggleEnabled(shortcut.accelerator, shortcut.enabled)}
                            title={shortcut.enabled ? 'Désactiver' : 'Activer'}
                          >
                            {shortcut.enabled ? '✓' : '✗'}
                          </button>
                        </div>
                        <button
                          className="remove-button"
                          onClick={() => handleRemoveShortcut(shortcut.accelerator)}
                          disabled={loading}
                        >
                          Supprimer
                        </button>
                      </>
                    ) : isEditing ? (
                      <>
                        <input
                          type="text"
                          className="shortcut-input"
                          value={newAccelerator}
                          onChange={(e) => setNewAccelerator(e.target.value)}
                          onKeyDown={(e) => handleKeyCapture(e, favorite.issue_key)}
                          placeholder="Appuyez sur une combinaison de touches..."
                          autoFocus
                        />
                        <button
                          className="save-button"
                          onClick={() => handleAddShortcut(favorite)}
                          disabled={loading || !newAccelerator}
                        >
                          Sauvegarder
                        </button>
                        <button
                          className="cancel-button"
                          onClick={() => {
                            setEditingShortcut(null);
                            setNewAccelerator('');
                          }}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        className="add-button"
                        onClick={() => {
                          setEditingShortcut(favorite.issue_key);
                          setNewAccelerator('');
                        }}
                      >
                        + Ajouter un raccourci
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {shortcuts.length > 0 && (
          <div className="shortcuts-summary">
            <h3>Raccourcis actifs</h3>
            <ul>
              {shortcuts.filter(s => s.enabled).map(s => (
                <li key={s.id}>
                  <kbd>{s.accelerator}</kbd> → {s.issue_key}: {s.issue_title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShortcutManager;
