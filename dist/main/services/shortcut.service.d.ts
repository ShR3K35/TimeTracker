import { EventEmitter } from 'events';
import { DatabaseManager, KeyboardShortcut } from '../database/schema';
export interface ShortcutEvent {
    accelerator: string;
    issueKey: string;
    issueTitle: string;
    issueType: string;
}
export declare class ShortcutService extends EventEmitter {
    private db;
    private registeredShortcuts;
    constructor(db: DatabaseManager);
    /**
     * Initialize shortcuts from database
     */
    initialize(): void;
    /**
     * Register a single keyboard shortcut
     */
    registerShortcut(shortcut: KeyboardShortcut): boolean;
    /**
     * Unregister a single keyboard shortcut
     */
    unregisterShortcut(accelerator: string): void;
    /**
     * Unregister all keyboard shortcuts
     */
    unregisterAll(): void;
    /**
     * Validate if an accelerator is valid
     */
    static isValidAccelerator(accelerator: string): boolean;
    /**
     * Check if a shortcut is already registered by the system or another app
     */
    isShortcutAvailable(accelerator: string): boolean;
    /**
     * Get all registered shortcuts
     */
    getRegisteredShortcuts(): string[];
}
