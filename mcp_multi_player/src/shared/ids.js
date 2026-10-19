// Ids and secrets (spec §8): series ids and the host key (seat tokens derive from it).

import { randomBytes } from 'node:crypto';

export const newSeriesId = () => 's_' + randomBytes(4).toString('hex');
export const newHostKey = () => randomBytes(18).toString('base64url');
