// src/types/express.d.ts
import "express";

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      rol?: string;
      email?: string;
    }

    interface Request {
      user?: UserPayload; // 👈 ahora req.user existe
    }
  }
}

export {};
