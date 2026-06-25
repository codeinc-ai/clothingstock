import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import {
  getAdminUser,
  verifyPassword,
  createToken,
  setSessionCookie,
  clearSessionCookie,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/login", (req: Request, res: Response) => {
  const password = (req.body as { password?: unknown })?.password;
  if (typeof password !== "string" || password.length === 0) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  let valid = false;
  try {
    valid = verifyPassword(password);
  } catch (err) {
    req.log.error({ err }, "Auth not configured");
    res.status(500).json({ error: "Authentication is not configured" });
    return;
  }

  if (!valid) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const user = getAdminUser();
  const token = createToken(user);
  setSessionCookie(res, token);
  res.json({ user, token });
});

router.post("/logout", (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

export default router;
