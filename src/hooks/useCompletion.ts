import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { ensureState } from '../utils/storage';
import type { AppState, ScheduleBlock } from '../types/appTypes';
import * as scheduleApi from '../api/schedule';

function useCompletion(
  appState: AppState,
  setAppState: Dispatch<SetStateAction<AppState>>,
  todayKeyValue: string,
  showToast: (message: string) => void
) {
  const completionByBlockId =
    appState.completion && appState.completion[todayKeyValue]
      ? appState.completion[todayKeyValue]
      : {};
  const scheduleBlocks = appState.schedule || [];
  const totalBlocks = scheduleBlocks.length;
  const doneCount = Object.values(completionByBlockId).filter(Boolean).length;
  const progressPercent = totalBlocks
    ? Math.round((doneCount / totalBlocks) * 100)
    : 0;
  const remainingCount = totalBlocks - doneCount;

  const setBlockCompletion = async (blockId: string, isComplete: boolean) => {
    const result = await scheduleApi.toggleCompletion(blockId, todayKeyValue, isComplete);
    if (!result.success) {
      showToast(result.error || 'Failed to update completion.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.completion[todayKeyValue] = Object.assign(
        {},
        next.completion[todayKeyValue] || {},
        { [blockId]: isComplete }
      );
      return next;
    });
  };

  const updateScheduleBlock = async (blockId: string, patch: Partial<ScheduleBlock>) => {
    const result = await scheduleApi.updateScheduleBlock(blockId, patch);
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to update schedule block.');
      return;
    }
    const data = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.schedule = (next.schedule || []).map((item) =>
        item.id === blockId
          ? Object.assign({}, item, {
              start: data.start,
              end: data.end,
              title: data.title,
              purpose: data.purpose || '',
              good: data.good || '',
              tag: data.tag || '',
              readonly: data.readonly,
              source: data.source as ScheduleBlock['source'],
            })
          : item
      );
      return next;
    });
  };

  const removeScheduleBlock = async (blockId: string) => {
    const result = await scheduleApi.deleteScheduleBlock(blockId);
    if (!result.success) {
      showToast(result.error || 'Failed to remove schedule block.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.schedule = (next.schedule || []).filter((item) => item.id !== blockId);
      if (next.completion && next.completion[todayKeyValue]) {
        const nextCompletion = Object.assign({}, next.completion[todayKeyValue]);
        delete nextCompletion[blockId];
        next.completion = Object.assign({}, next.completion, {
          [todayKeyValue]: nextCompletion,
        });
      }
      return next;
    });
  };

  const addScheduleBlock = async (block: ScheduleBlock) => {
    const payload = Object.assign({}, block);
    delete (payload as Partial<ScheduleBlock>).id;
    const result = await scheduleApi.createScheduleBlock(payload as Omit<ScheduleBlock, 'id'>);
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to add schedule block.');
      return;
    }
    const data = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const list = next.schedule || [];
      next.schedule = list.concat([
        {
          id: data.id,
          start: data.start,
          end: data.end,
          title: data.title,
          purpose: data.purpose || '',
          good: data.good || '',
          tag: data.tag || '',
          readonly: data.readonly,
          source: data.source as ScheduleBlock['source'],
        },
      ]);
      return next;
    });
  };

  const summary = useMemo(() => {
    return {
      totalBlocks,
      doneCount,
      progressPercent,
      remainingCount,
    };
  }, [totalBlocks, doneCount, progressPercent, remainingCount]);

  return {
    completionByBlockId,
    scheduleBlocks,
    totalBlocks,
    doneCount,
    progressPercent,
    remainingCount,
    setBlockCompletion,
    updateScheduleBlock,
    removeScheduleBlock,
    addScheduleBlock,
    summary,
  };
}

export default useCompletion;
