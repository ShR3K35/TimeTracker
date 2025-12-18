import { globalShortcut } from 'electron';
import { EventEmitter } from 'events';
import { DatabaseManager, KeyboardShortcut } from '../database/schema';

export interface ShortcutEvent {
  accelerator: string;
  issueKey: string;
  issueTitle: string;
  issueType: string;
}

export class ShortcutService extends EventEmitter {
  private db: DatabaseManager;
  private registeredShortcuts: Set<string> = new Set();

  constructor(db: DatabaseManager) {
    super();
    this.db = db;
  }

  /**
   * Initialize shortcuts from database
   */
  initialize(): void {
    this.unregisterAll();
    const shortcuts = this.db.getEnabledKeyboardShortcuts();

    console.log(`[ShortcutService] Initializing ${shortcuts.length} shortcuts`);

    for (const shortcut of shortcuts) {
      const success = this.registerShortcut(shortcut);
      console.log(`[ShortcutService] Shortcut ${shortcut.accelerator} -> ${shortcut.issue_key}: ${success ? 'registered' : 'FAILED'}`);
    }

    console.log(`[ShortcutService] Registered shortcuts: ${Array.from(this.registeredShortcuts).join(', ')}`);
  }

  /**
   * Register a single keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): boolean {
    if (!shortcut.enabled) {
      console.log(`[ShortcutService] Shortcut ${shortcut.accelerator} is disabled, skipping`);
      return false;
    }

    try {
      console.log(`[ShortcutService] Attempting to register: ${shortcut.accelerator}`);
      const success = globalShortcut.register(shortcut.accelerator, () => {
        console.log(`[ShortcutService] Shortcut triggered: ${shortcut.accelerator} -> ${shortcut.issue_key}`);
        this.emit('shortcut-triggered', {
          accelerator: shortcut.accelerator,
          issueKey: shortcut.issue_key,
          issueTitle: shortcut.issue_title,
          issueType: shortcut.issue_type,
        } as ShortcutEvent);
      });

      if (success) {
        this.registeredShortcuts.add(shortcut.accelerator);
        console.log(`[ShortcutService] Successfully registered: ${shortcut.accelerator}`);
        return true;
      } else {
        console.error(`[ShortcutService] Failed to register shortcut: ${shortcut.accelerator} - globalShortcut.register returned false`);
        return false;
      }
    } catch (error) {
      console.error(`[ShortcutService] Error registering shortcut ${shortcut.accelerator}:`, error);
      return false;
    }
  }

  /**
   * Unregister a single keyboard shortcut
   */
  unregisterShortcut(accelerator: string): void {
    if (this.registeredShortcuts.has(accelerator)) {
      globalShortcut.unregister(accelerator);
      this.registeredShortcuts.delete(accelerator);
    }
  }

  /**
   * Unregister all keyboard shortcuts
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.registeredShortcuts.clear();
  }

  /**
   * Validate if an accelerator is valid
   */
  static isValidAccelerator(accelerator: string): boolean {
    try {
      // Try to register and immediately unregister to test validity
      const testResult = globalShortcut.register(accelerator, () => {});
      if (testResult) {
        globalShortcut.unregister(accelerator);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if a shortcut is already registered by the system or another app
   */
  isShortcutAvailable(accelerator: string): boolean {
    // First check if it's registered by us
    if (this.registeredShortcuts.has(accelerator)) {
      return false;
    }

    // Try to register temporarily
    try {
      const success = globalShortcut.register(accelerator, () => {});
      if (success) {
        globalShortcut.unregister(accelerator);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get all registered shortcuts
   */
  getRegisteredShortcuts(): string[] {
    return Array.from(this.registeredShortcuts);
  }
}
