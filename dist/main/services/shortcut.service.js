"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcutService = void 0;
const electron_1 = require("electron");
const events_1 = require("events");
class ShortcutService extends events_1.EventEmitter {
    constructor(db) {
        super();
        this.registeredShortcuts = new Set();
        this.db = db;
    }
    /**
     * Initialize shortcuts from database
     */
    initialize() {
        this.unregisterAll();
        const shortcuts = this.db.getEnabledKeyboardShortcuts();
        for (const shortcut of shortcuts) {
            this.registerShortcut(shortcut);
        }
    }
    /**
     * Register a single keyboard shortcut
     */
    registerShortcut(shortcut) {
        if (!shortcut.enabled) {
            return false;
        }
        try {
            const success = electron_1.globalShortcut.register(shortcut.accelerator, () => {
                this.emit('shortcut-triggered', {
                    accelerator: shortcut.accelerator,
                    issueKey: shortcut.issue_key,
                    issueTitle: shortcut.issue_title,
                    issueType: shortcut.issue_type,
                });
            });
            if (success) {
                this.registeredShortcuts.add(shortcut.accelerator);
                return true;
            }
            else {
                console.error(`Failed to register shortcut: ${shortcut.accelerator}`);
                return false;
            }
        }
        catch (error) {
            console.error(`Error registering shortcut ${shortcut.accelerator}:`, error);
            return false;
        }
    }
    /**
     * Unregister a single keyboard shortcut
     */
    unregisterShortcut(accelerator) {
        if (this.registeredShortcuts.has(accelerator)) {
            electron_1.globalShortcut.unregister(accelerator);
            this.registeredShortcuts.delete(accelerator);
        }
    }
    /**
     * Unregister all keyboard shortcuts
     */
    unregisterAll() {
        electron_1.globalShortcut.unregisterAll();
        this.registeredShortcuts.clear();
    }
    /**
     * Validate if an accelerator is valid
     */
    static isValidAccelerator(accelerator) {
        try {
            // Try to register and immediately unregister to test validity
            const testResult = electron_1.globalShortcut.register(accelerator, () => { });
            if (testResult) {
                electron_1.globalShortcut.unregister(accelerator);
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    /**
     * Check if a shortcut is already registered by the system or another app
     */
    isShortcutAvailable(accelerator) {
        // First check if it's registered by us
        if (this.registeredShortcuts.has(accelerator)) {
            return false;
        }
        // Try to register temporarily
        try {
            const success = electron_1.globalShortcut.register(accelerator, () => { });
            if (success) {
                electron_1.globalShortcut.unregister(accelerator);
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    /**
     * Get all registered shortcuts
     */
    getRegisteredShortcuts() {
        return Array.from(this.registeredShortcuts);
    }
}
exports.ShortcutService = ShortcutService;
