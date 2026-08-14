import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, Profile } from "@/src/api";

const ACTIVE_KEY = "aida.activeProfileId";

type Ctx = {
  profiles: Profile[];
  activeProfile: Profile | null;
  activeId: string | null;
  loading: boolean;
  error: string | null;
  setActive: (id: string) => void;
  reload: () => Promise<void>;
  refreshTick: number;
  bumpRefresh: () => void;
};

const AppContext = createContext<Ctx>({
  profiles: [],
  activeProfile: null,
  activeId: null,
  loading: true,
  error: null,
  setActive: () => {},
  reload: async () => {},
  refreshTick: 0,
  bumpRefresh: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.seed().catch(() => {});
      let list = await api.listProfiles();
      if (!list || list.length === 0) {
        await api.seed().catch(() => {});
        list = await api.listProfiles();
      }
      setProfiles(list);
      const stored = await storage.getItem<string>(ACTIVE_KEY, "");
      const valid = list.find((p) => p.id === stored);
      const nextId = valid ? valid.id : list[0]?.id ?? null;
      setActiveId(nextId);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    storage.setItem(ACTIVE_KEY, id);
    setRefreshTick((t) => t + 1);
  }, []);

  const bumpRefresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  return (
    <AppContext.Provider
      value={{
        profiles,
        activeProfile,
        activeId,
        loading,
        error,
        setActive,
        reload: load,
        refreshTick,
        bumpRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
