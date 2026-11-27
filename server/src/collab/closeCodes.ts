// Application-defined WebSocket close codes (4000-4999 are reserved for apps like ours).
// A browser cannot see the HTTP status of a refused WebSocket upgrade, but it CAN read the
// close code of a connection that was accepted and then closed. That lets the editor tell
// the person WHY they were refused instead of silently retrying forever.
export const CLOSE_UNAUTHORIZED = 4401; // missing, forged or expired token
export const CLOSE_FORBIDDEN = 4403; // signed in, but no access to this document
export const CLOSE_NOT_FOUND = 4404; // no such document
