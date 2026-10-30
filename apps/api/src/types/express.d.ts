import { UserPayload } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}
