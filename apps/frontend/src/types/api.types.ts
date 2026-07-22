/**
 * Transport-level types. The backend wraps every response in
 * { success, data } and every failure in { success:false, error }, so
 * the client can unwrap uniformly instead of guessing per endpoint.
 */

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    /** field-level messages from Zod on the server */
    details?: Record<string, string[]>;
  };
}

/** Normalized error every layer of the UI can rely on. */
export interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  /** true when the request never reached the server */
  isNetworkError: boolean;
}
