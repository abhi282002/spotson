import { Router } from 'express';
import { db } from '../lib/database/db.js';
import { matches } from '../lib/database/schema.js';
import {
  createMatchSchema,
  limitMatchesQuerySchema,
} from '../validation/matches.js';
import { getMatchStatus } from '../utils/match-status.js';
import { desc } from 'drizzle-orm';

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get('/', async (req, res) => {
  const parsed = limitMatchesQuerySchema.safeParse(req.query);
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  if (!parsed.success) {
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload.',
        details: parsed.error.issues,
      });
    }
  }
  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    res.status(200).json({
      data,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        error: error.message,
      });
    }
  }
});

matchRouter.post('/', async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  const {
    data: { startTime, endTime, homeScore, awayScore },
  } = parsed;

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload.',
      details: parsed.error.issues,
    });
  }

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
      })
      .returning();

    if (res.app.locals.broadcastMatchCreated) {
      res.app.locals.broadcastMatchCreated(event);
    }
    
    res.status(201).json({
      data: event,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        error: error.message,
      });
    }
  }
});
