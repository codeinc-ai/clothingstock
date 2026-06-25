import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import articlesRouter from "./articles";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use("/articles", articlesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/settings", settingsRouter);

export default router;
