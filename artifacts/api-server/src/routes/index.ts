import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bagCounterRouter from "./bagCounter";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bagCounterRouter);

export default router;
