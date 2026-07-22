/**
 * Collaboration error taxonomy. Each maps to one of the four failure
 * modes the product must handle: connection lost, sync failure, invalid
 * document, permission denied. Carrying a stable `code` lets the UI
 * react (toast, retry, redirect) without string-matching messages.
 */
export class CollabError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ConnectionLostError extends CollabError {
  constructor(message = 'Realtime connection lost') {
    super('CONNECTION_LOST', message);
  }
}
export class SyncFailureError extends CollabError {
  constructor(message = 'Failed to synchronize document state') {
    super('SYNC_FAILURE', message);
  }
}
export class InvalidDocumentError extends CollabError {
  constructor(message = 'Document is invalid or corrupted') {
    super('INVALID_DOCUMENT', message);
  }
}
export class PermissionDeniedError extends CollabError {
  constructor(message = 'You do not have permission to edit this document') {
    super('PERMISSION_DENIED', message);
  }
}
