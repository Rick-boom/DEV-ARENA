import { useEffect, useRef } from 'react';
import { SUBMISSION_POLL } from '@/constants/editor.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectSubmissionState } from '@/store/selectors.js';
import { submitFailed, submitResolved, isPendingVerdict } from '@/store/slices/submission-slice.js';
import { useLazyGetSubmissionQuery } from '@/store/api/submission-api.js';

/**
 * Polls a queued submission until the judge returns a terminal verdict.
 *
 * Submission is asynchronous (the API answers 202 with an id), so the
 * client has to ask. Polling — rather than a socket — keeps this module
 * independent of the realtime layer, which is separate scope.
 *
 * A hard timeout stops the loop from running forever if the judge never
 * answers; the user gets a clear message instead of a spinner that never
 * resolves.
 */
export function useSubmissionPolling(): void {
  const dispatch = useAppDispatch();
  const { activeSubmissionId } = useAppSelector(selectSubmissionState);
  const [fetchSubmission] = useLazyGetSubmissionQuery();
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!activeSubmissionId) {
      startedAt.current = null;
      return;
    }
    startedAt.current = Date.now();
    let cancelled = false;

    const tick = async (): Promise<void> => {
      if (cancelled) return;

      if (Date.now() - (startedAt.current ?? 0) > SUBMISSION_POLL.TIMEOUT_MS) {
        dispatch(submitFailed('The judge is taking longer than expected. Check your submissions.'));
        return;
      }

      try {
        const detail = await fetchSubmission(activeSubmissionId).unwrap();
        if (cancelled) return;

        if (isPendingVerdict(detail.status)) {
          timer = setTimeout(() => void tick(), SUBMISSION_POLL.INTERVAL_MS);
        } else {
          dispatch(submitResolved(detail));
        }
      } catch {
        if (!cancelled) {
          dispatch(submitFailed("Couldn't reach the judge. Your submission was still recorded."));
        }
      }
    };

    let timer = setTimeout(() => void tick(), SUBMISSION_POLL.INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSubmissionId, dispatch, fetchSubmission]);
}
