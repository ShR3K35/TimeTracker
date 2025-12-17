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

    for (const shortcut of shortcuts) {
      this.registerShortcut(shortcut);
    }
  }

  /**
   * Register a single keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): boolean {
    if (!shortcut.enabled) {
      return false;
    }

    try {
      const success = globalShortcut.register(shortcut.accelerator, () => {
        this.emit('shortcut-triggered', {
          accelerator: shortcut.accelerator,
          issueKey: shortcut.issue_key,
          issueTitle: shortcut.issue_title,
          issueType: shortcut.issue_type,
        } as ShortcutEvent);
      });

      if (success) {
        this.registeredShortcuts.add(shortcut.accelerator);
        return true;
      } else {
        console.error(`Failed to register shortcut: ${shortcut.accelerator}`);
        return false;
      }
    } catch (error) {
      console.error(`Error registering shortcut ${shortcut.accelerator}:`, error);
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
