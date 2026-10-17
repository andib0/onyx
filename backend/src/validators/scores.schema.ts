import { z } from 'zod';
import { isoDate } from './common.schema.js';

// Legacy client snapshot. Only `date` is used: the server computes the score
// itself, other fields are accepted and ignored for backward compatibility.
export const upsertScoreSchema = z.object({ date: isoDate }).passthrough();
