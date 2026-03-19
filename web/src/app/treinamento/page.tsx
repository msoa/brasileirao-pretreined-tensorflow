import { AppShell } from "@/components/app-shell";
import {
  TreinamentoAjudaContent,
  TreinamentoChartsContent,
  TreinamentoContent,
  TreinamentoProvider,
} from "./treinamento-content";

export default function TreinamentoPage() {
  return (
    <AppShell>
      <TreinamentoProvider>
        <TreinamentoContent />
        <TreinamentoChartsContent className="mt-4" />
        <TreinamentoAjudaContent className="mt-4" />
      </TreinamentoProvider>
    </AppShell>
  );
}
