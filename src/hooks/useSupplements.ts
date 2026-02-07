import type { Dispatch, SetStateAction } from 'react';

import { ensureState } from '../utils/storage';
import type { AppState, SupplementItem } from '../types/appTypes';
import * as supplementsApi from '../api/supplements';

function useSupplements(
  appState: AppState,
  setAppState: Dispatch<SetStateAction<AppState>>,
  todayKeyValue: string,
  showToast: (message: string) => void
) {
  const supplementsList = appState.supplementsList || [];
  const supplementChecksForToday =
    appState.suppLog && appState.suppLog[todayKeyValue]
      ? appState.suppLog[todayKeyValue]
      : appState.supp || {};
  const supplementLogByDate = appState.suppLog || {};

  const setSupplementChecked = async (supplementId: string, isChecked: boolean) => {
    const result = await supplementsApi.toggleSupplementLog(
      supplementId,
      todayKeyValue,
      isChecked
    );
    if (!result.success) {
      showToast(result.error || 'Failed to update supplement log.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.suppLog = Object.assign({}, next.suppLog, {
        [todayKeyValue]: Object.assign(
          {},
          next.suppLog[todayKeyValue] || {},
          { [supplementId]: isChecked }
        ),
      });
      return next;
    });
  };

  const addSupplementItem = async (supplement: SupplementItem) => {
    const payload = Object.assign({}, supplement);
    delete (payload as Partial<SupplementItem>).id;
    const result = await supplementsApi.createSupplement(payload as Omit<SupplementItem, 'id'>);
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to add supplement.');
      return;
    }
    const data = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const list = next.supplementsList || [];
      next.supplementsList = list.concat([
        {
          id: data.id,
          item: data.item,
          goal: data.goal,
          dose: data.dose,
          tier: data.tier || undefined,
          rule: data.rule || undefined,
          timeAt: data.timeAt,
        },
      ]);
      return next;
    });
    showToast('Supplement added.');
  };

  const updateSupplementItem = async (supplementId: string, patch: Partial<SupplementItem>) => {
    const result = await supplementsApi.updateSupplement(supplementId, patch);
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to update supplement.');
      return;
    }
    const data = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.supplementsList = (next.supplementsList || []).map((item) =>
        item.id === supplementId
          ? Object.assign({}, item, {
              item: data.item,
              goal: data.goal,
              dose: data.dose,
              tier: data.tier || undefined,
              rule: data.rule || undefined,
              timeAt: data.timeAt,
            })
          : item
      );
      return next;
    });
  };

  const removeSupplementItem = async (supplementId: string) => {
    const result = await supplementsApi.deleteSupplement(supplementId);
    if (!result.success) {
      showToast(result.error || 'Failed to remove supplement.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.supplementsList = (next.supplementsList || []).filter(
        (item) => item.id !== supplementId
      );
      const nextSupp = Object.assign({}, next.supp);
      delete nextSupp[supplementId];
      next.supp = nextSupp;
      return next;
    });
    showToast('Supplement removed.');
  };

  const clearSupplementChecks = async () => {
    const entries = supplementsList.map((item) => item.id).filter(Boolean) as string[];
    if (!entries.length) return;
    const updates = entries.map((supplementId) =>
      supplementsApi.toggleSupplementLog(supplementId, todayKeyValue, false)
    );
    const results = await Promise.all(updates);
    if (results.some((result) => !result.success)) {
      showToast('Some supplements failed to clear.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.suppLog = Object.assign({}, next.suppLog, { [todayKeyValue]: {} });
      return next;
    });
    showToast('Cleared.');
  };

  return {
    supplementsList,
    supplementChecksForToday,
    supplementLogByDate,
    setSupplementChecked,
    addSupplementItem,
    updateSupplementItem,
    removeSupplementItem,
    clearSupplementChecks,
  };
}

export default useSupplements;
