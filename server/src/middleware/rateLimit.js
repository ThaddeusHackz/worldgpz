import { rateLimit as expressRateLimit } from 'express-rate-limit';

export const loginLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait and try again.' },
});

export const analystLimiter = expressRateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Analyst request limit reached. Wait a few minutes before trying again.' },
});

export const apiLimiter = expressRateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/stream',
  message: { error: 'Request limit reached. Try again shortly.' },
});
