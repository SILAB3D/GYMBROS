import { createTRPCRouter } from "@/server/api/trpc";
import { userRouter } from "@/server/api/routers/user";
import { exerciseRouter } from "@/server/api/routers/exercise";
import { routineRouter } from "@/server/api/routers/routine";
import { workoutRouter } from "@/server/api/routers/workout";
import { attendanceRouter } from "@/server/api/routers/attendance";
import { prRouter } from "@/server/api/routers/pr";
import { metricsRouter } from "@/server/api/routers/metrics";
import { rankingRouter } from "@/server/api/routers/ranking";
import { notificationRouter } from "@/server/api/routers/notification";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { feedRouter } from "@/server/api/routers/feed";
import { statsRouter } from "@/server/api/routers/stats";
import { adminRouter } from "@/server/api/routers/admin";
import { feedbackRouter } from "@/server/api/routers/feedback";
import { planRouter } from "@/server/api/routers/plan";
import { chatRouter } from "@/server/api/routers/chat";
import { pushRouter } from "@/server/api/routers/push";

export const appRouter = createTRPCRouter({
  user: userRouter,
  exercise: exerciseRouter,
  routine: routineRouter,
  workout: workoutRouter,
  attendance: attendanceRouter,
  pr: prRouter,
  metrics: metricsRouter,
  ranking: rankingRouter,
  notification: notificationRouter,
  dashboard: dashboardRouter,
  feed: feedRouter,
  stats: statsRouter,
  admin: adminRouter,
  feedback: feedbackRouter,
  plan: planRouter,
  chat: chatRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;
