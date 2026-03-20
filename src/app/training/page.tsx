import { AppShell } from "@/components/app-shell";
import {
  TrainingChartsContent,
  TrainingContent,
  TrainingHelpContent,
  TrainingProvider,
} from "./training-content";
export default function TrainingPage() {
  return (
    <AppShell>
      <TrainingProvider>
        <TrainingContent />
        <TrainingChartsContent className="mt-4" />
        <TrainingHelpContent className="mt-4" />
      </TrainingProvider>
    </AppShell>
  );
}
