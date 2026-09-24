import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { QuizScreen } from "../../../../screens/learn/quiz";

export const Route = createFileRoute("/_app/learn/quizzes/$module")({
  ...screenOptions("SCR-006"),
  component: function QuizRoute() {
    const { module } = Route.useParams();
    return <QuizScreen module={module} />;
  },
});
