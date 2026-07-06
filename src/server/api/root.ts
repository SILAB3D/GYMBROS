import { createTRPCRouter } from "@/server/api/trpc";
import { userRouter } from "@/server/api/routers/user";
import { exerciseRouter } from "@/server/api/routers/exercise";
import { routineRouter } from "@/server/api/routers/routine";
import { workoutRouter } from "@/server/api/routers/workout";
import { attendanceRouter } from "@/server/api/routers/attendance";
import { prRouter } from "@/server/api/routers/pr";
import { metricsRouter } from "@/server/api/routers/metrics";
import { goalRouter } from "@/server/api/routers/goal";
import { rankingRouter } from "@/server/api/routers/ranking";
import { notificationRouter } from "@/server/api/routers/notification";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { feedRouter } from "@/server/api/routers/feed";
import { statsRouter } from "@/server/api/routers/stats";
import { adminRouter } from "@/server/api/routers/admin";

export const appRouter = createTRPCRouter({
  user: userRouter,
  exercise: exerciseRouter,
  routine: routineRouter,
  workout: workoutRouter,
  attendance: attendanceRouter,
  pr: prRouter,
  metrics: metricsRouter,
  goal: goalRouter,
  ranking: rankingRouter,
  notification: notificationRouter,
  dashboard: dashboardRouter,
  feed: feedRouter,
  stats: statsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
