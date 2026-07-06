"use client";

import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Spinner } from "@/components/ui";
import { RoutineForm } from "@/components/routine-form";

export default function EditRoutinePage() {
  const params = useParams<{ id: string }>();
  const { data: routine, isLoading } = api.routine.byId.useQuery({ id: params.id });

  if (isLoading || !routine) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar rutina</h1>
      <RoutineForm
        routineId={routine.id}
        initial={{
          name: routine.name,
          description: routine.description ?? "",
          color: routine.color,
          emoji: routine.emoji,
          recommendedDays: routine.recommendedDays,
          estimatedMinutes: routine.estimatedMinutes,
          exercises: routine.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            name: e.exercise.name,
            sets: e.sets,
            reps: e.reps,
            targetWeight: e.targetWeight,
            restSeconds: e.restSeconds,
            notes: e.notes,
          })),
        }}
      />
    </div>
  );
}
