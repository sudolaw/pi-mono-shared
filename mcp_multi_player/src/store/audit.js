// The private log (spec §9): moves submitted before they are revealed, rejected moves and
// timeouts. Same format as the public log; never served to the web.

export { createAppender as createAuditAppender, readLines as readAudit } from './log.js';
