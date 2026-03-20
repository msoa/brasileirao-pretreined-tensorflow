import { AppShell } from "@/components/app-shell";
import { ExplorationContent } from "@/app/exploration/page";
import {
  TrainingChartsContent,
  TrainingContent,
  TrainingHelpContent,
  TrainingProvider,
} from "@/app/training/training-content";
import { PredictionsContent } from "@/app/predictions/page";
import { ModelOverviewCards } from "@/components/model-overview-cards";
import { getDataSummary } from "@/lib/server/csv-data";
import { mlGet } from "@/lib/server/ml-client";

async function getModelInfo() {
  try {
    return await mlGet("/model/info");
  } catch {
    return null;
  }
}

export default async function Home() {
  const [summary, model] = await Promise.all([getDataSummary(), getModelInfo()]);

  return (
    <AppShell>
      <section id="dashboard" className="scroll-mt-24">
        <h2 className="text-xl font-semibold">Base de dados e modelo</h2>
        <p className="mt-2 text-sm text-muted">Fluxo rápido: ajuste, treine, observe e preveja.</p>
        <ModelOverviewCards summary={summary} initialModel={model} />
        <p className="mt-4 text-sm text-muted">
          Dados originários de{" "}
          <a href="https://www.kaggle.com/datasets/adaoduque/campeonato-brasileiro-de-futebol" target="_blank" rel="noreferrer" className="underline">
            Kaggle: Campeonato Brasileiro de Futebol
          </a>
        </p>
      </section>

      <section id="training" className="mt-10 scroll-mt-24">
        <TrainingProvider>
          <h2 className="text-xl font-semibold">Treinamento</h2>
          <div className="mt-4">
            <TrainingContent />
          </div>
          <div className="mt-6">
            <TrainingChartsContent />
          </div>
        </TrainingProvider>
      </section>

      <section id="predictions" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Previsões</h2>
        <div className="mt-4">
          <PredictionsContent />
        </div>
      </section>

      <section id="exploration" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Exploração</h2>
        <div className="mt-4">
          <ExplorationContent />
        </div>
      </section>

      <section id="about-me" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Sobre mim</h2>
        <section className="card-neon">
          <p className="text-base font-semibold">Marco Sérgio de O. Araújo</p>
          <p className="mt-2 text-sm">
            Software Engineer N1 no iFood com 20+ anos construindo sistemas robustos e escaláveis. Especialista em microsserviços, cloud AWS, DevOps e liderança técnica. Sou apaixonado por resolver problemas complexos, mentorar equipes e impulsionar a excelência arquitetural. Atualmente foco em IA generativa e observabilidade para produtos de alto volume. Baseado no Rio de Janeiro.
          </p>
          <div className="mt-4 gap-2 space-y-1 text-sm text-muted">
            <p><span className="font-semibold text-foreground">Experiência:</span> iFood (2025-atual) • OLX Brasil (2022-2025) • Bemobi/M4U (2012-2022) • CTIS, Fundação do Câncer, CETIP (2002-2012)</p>
            <p><span className="font-semibold text-foreground">Formação:</span> IA Aplicada (UNIPDS) • Arquitetura de Soluções (PUC Minas) • Gestão de TI (Cândido Mendes)</p>
            <p className="mt-2">
              <a href="https://www.linkedin.com/in/marcosergio/" target="_blank" rel="noreferrer" className="underline">
                linkedin.com/in/marcosergio
              </a>
            </p>
          </div>
        </section>
      </section>

      <section id="notice" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Aviso acadêmico</h2>
        <section className="card-neon mt-4">
          <p className="text-sm text-muted">
            Este serviço foi desenvolvido para fins acadêmicos, educacionais e de experimentação em ciência de dados e
            machine learning aplicados ao futebol. Os resultados apresentados são estimativas estatísticas e podem conter
            imprecisões. Não garantimos acurácia, completude ou adequação para tomada de decisão real. Não nos
            responsabilizamos por perdas, danos, decisões financeiras, apostas ou qualquer uso direto/indireto das
            previsões e análises exibidas nesta aplicação.
          </p>
        </section>
      </section>

      <section id="help" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Ajuda</h2>
        <div className="mt-4">
          <TrainingHelpContent />
        </div>
      </section>
    </AppShell>
  );
}
