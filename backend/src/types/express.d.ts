import "express";

declare global {
  namespace Express {
    interface UserJWT {
      id: number;
      rol?: string;
      email?: string;
      mustChangePassword?: boolean;
    }
    interface Request {
      user?: UserJWT;
    }
  }
}

export {};
