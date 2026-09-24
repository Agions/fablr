/**
 * createPersistedStore — Zustand store factory with devtools + persist
 *
 * Reduces the repeated boilerplate of:
 *   create<State>()(
 *     devtools(
 *       persist((set, get) => ({ ... }), { name, storage, partialize })
 *     ),
 *     { name: 'StoreName' }
 *   )
 *
 * Usage:
 *   export const useAppStore = createPersistedStore<AppState>({
 *     name: 'fablr-app',
 *     devtoolsName: 'AppStore',
 *     storage: createJSONStorage(() => localStorage),
 *     partialize: (state) => ({ theme: state.theme }),
 *     state: (set, get) => ({
 *       user: null,
 *       theme: 'light',
 *       setUser: (user) => set({ user }),
 *     }),
 *   });
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

export interface PersistedStoreOptions<S> {
  name: string;
  legacyName?: string;
  devtoolsName: string;
  state: (
    set: (partial: Partial<S> | ((prev: S) => Partial<S>)) => void,
    get: () => S
  ) => S;
  storage?: ReturnType<typeof createJSONStorage>;
  partialize?: (state: S) => Partial<S>;
}

export function createPersistedStore<S>({
  name,
  legacyName,
  devtoolsName,
  state,
  storage = createJSONStorage(() => localStorage),
  partialize,
}: PersistedStoreOptions<S>) {
  if (typeof localStorage !== 'undefined' && legacyName) {
    try {
      const current = localStorage.getItem(name);
      if (!current) {
        const legacy = localStorage.getItem(legacyName);
        if (legacy) {
          localStorage.setItem(name, legacy);
          localStorage.removeItem(legacyName);
        }
      }
    } catch {
      /* ignore migration errors */
    }
  }

  const storeState = (set: (partial: Partial<S> | ((prev: S) => Partial<S>)) => void, get: () => S): S => {
    return state(set, get);
  };

  return create<S>()(
    devtools(
      persist(storeState, {
        name,
        storage,
        partialize,
      }),
      { name: devtoolsName }
    )
  );
}
