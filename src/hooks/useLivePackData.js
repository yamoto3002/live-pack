import { useCallback, useEffect, useRef, useState } from 'react';
import { createBand, listBandsForUser } from '../services/bandService';
import { toLivePackDataError } from '../services/dataError';
import { loadLivePackData } from '../services/livePackDataService';
import { emptyLivePackData } from '../services/livePackMapper';
import { prepareNoteIds, syncLivePackDiff } from '../services/livePackSyncService';
import {
  getSelectedBandId,
  loadClientState,
  saveClientState,
  setSelectedBandId as persistSelectedBandId,
} from '../storage/localStore';

export function useLivePackData(user, { enabled = true } = {}) {
  const [clientState] = useState(loadClientState);
  const [data, setData] = useState(() => emptyLivePackData(clientState));
  const [bands, setBands] = useState([]);
  const [selectedBandId, setSelectedBandId] = useState(null);
  const [loadingBands, setLoadingBands] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [savingCount, setSavingCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dataRef = useRef(data);
  const selectedBandRef = useRef(selectedBandId);
  const requestRef = useRef(0);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    selectedBandRef.current = selectedBandId;
  }, [selectedBandId]);

  const refreshBands = useCallback(async () => {
    if (!user || !enabled) return [];
    setLoadingBands(true);
    setError('');
    try {
      const nextBands = await listBandsForUser(user.id);
      setBands(nextBands);
      const storedId = getSelectedBandId();
      const currentId = selectedBandRef.current;
      const nextId = [currentId, storedId].find(
        (candidate) => candidate && nextBands.some((band) => band.id === candidate),
      ) || nextBands[0]?.id || null;
      setSelectedBandId(nextId);
      persistSelectedBandId(nextId);
      return nextBands;
    } catch (cause) {
      setError(toLivePackDataError(cause, 'バンド一覧の取得').message);
      return [];
    } finally {
      setLoadingBands(false);
    }
  }, [enabled, user]);

  const refreshData = useCallback(async (bandId = selectedBandRef.current) => {
    if (!user || !enabled || !bandId) {
      const next = emptyLivePackData(clientState);
      dataRef.current = next;
      setData(next);
      return;
    }
    const requestId = ++requestRef.current;
    setLoadingData(true);
    setError('');
    try {
      const next = await loadLivePackData(bandId, user.id, loadClientState());
      if (requestRef.current !== requestId || selectedBandRef.current !== bandId) return;
      dataRef.current = next;
      setData(next);
    } catch (cause) {
      if (requestRef.current === requestId) {
        setError(toLivePackDataError(cause, 'バンドデータの取得').message);
      }
    } finally {
      if (requestRef.current === requestId) setLoadingData(false);
    }
  }, [clientState, enabled, user]);

  useEffect(() => {
    if (!enabled || !user) {
      setBands([]);
      setSelectedBandId(null);
      return;
    }
    refreshBands();
  }, [enabled, refreshBands, user]);

  useEffect(() => {
    if (selectedBandId) refreshData(selectedBandId);
  }, [refreshData, selectedBandId]);

  const selectBand = useCallback((bandId) => {
    if (!bands.some((band) => band.id === bandId)) return;
    selectedBandRef.current = bandId;
    setSelectedBandId(bandId);
    persistSelectedBandId(bandId);
    setNotice('');
    setError('');
  }, [bands]);

  const addBand = useCallback(async (values) => {
    if (!user) return null;
    setSavingCount((count) => count + 1);
    setError('');
    try {
      const band = await createBand({ ...values, userId: user.id });
      await refreshBands();
      selectedBandRef.current = band.id;
      setSelectedBandId(band.id);
      persistSelectedBandId(band.id);
      setNotice('バンドを作成しました。');
      return band;
    } catch (cause) {
      setError(toLivePackDataError(cause, 'バンドの作成').message);
      return null;
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  }, [refreshBands, user]);

  const update = useCallback((mutator, successMessage = 'Supabaseへ保存しました。') => {
    const bandId = selectedBandRef.current;
    if (!user || !bandId) return Promise.resolve(false);

    const before = dataRef.current;
    const draft = structuredClone(before);
    const after = mutator(draft) ?? draft;
    prepareNoteIds(before, after);
    dataRef.current = after;
    setData(after);
    saveClientState(after);
    setError('');
    setNotice('');
    setSavingCount((count) => count + 1);

    const task = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        await syncLivePackDiff({
          before,
          after,
          bandId,
          currentUserId: user.id,
        });
        if (selectedBandRef.current === bandId) {
          await refreshData(bandId);
          setNotice(successMessage);
        }
        return true;
      })
      .catch(async (cause) => {
        setError(toLivePackDataError(cause, 'データの保存').message);
        if (selectedBandRef.current === bandId) await refreshData(bandId);
        return false;
      })
      .finally(() => setSavingCount((count) => Math.max(0, count - 1)));
    queueRef.current = task;
    return task;
  }, [refreshData, user]);

  const clearMessage = useCallback(() => {
    setError('');
    setNotice('');
  }, []);

  return {
    data,
    bands,
    selectedBandId,
    selectedBand: bands.find((band) => band.id === selectedBandId) ?? null,
    loadingBands,
    loadingData,
    saving: savingCount > 0,
    error,
    notice,
    refreshBands,
    refreshData,
    selectBand,
    addBand,
    update,
    clearMessage,
  };
}
