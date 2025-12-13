/// <reference types="node" />

declare module 'electron' {
  interface App {
    isQuitting?: boolean;
  }
}

export {};
