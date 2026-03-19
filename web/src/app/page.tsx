import { AppShell } from "@/components/app-shell";
import { ExploracaoContent } from "@/app/exploracao/page";
import {
  TreinamentoAjudaContent,
  TreinamentoChartsContent,
  TreinamentoContent,
  TreinamentoProvider,
} from "@/app/treinamento/treinamento-content";
import { PrevisoesContent } from "@/app/previsoes/page";
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
        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="card-neon">
            <p className="text-muted">Partidas na base</p>
            <p className="text-2xl font-semibold">{summary?.totalMatches ?? "-"}</p>
          </article>
          <article className="card-neon">
            <p className="text-muted">Times únicos</p>
            <p className="text-2xl font-semibold">{summary?.totalTeams ?? "-"}</p>
          </article>
          <article className="card-neon">
            <p className="text-muted">Modelo treinado</p>
            <p className="text-2xl font-semibold">{model?.trained ? "Sim" : "Não"}</p>
          </article>
          <article className="card-neon">
            <p className="text-muted">Acurácia teste</p>
            <p className="text-2xl font-semibold">
              {typeof model?.test_accuracy === "number" ? `${(model.test_accuracy * 100).toFixed(1)}%` : "-"}
            </p>
          </article>
        </section>
        <p className="mt-4 text-sm text-muted">
          Dados originários de{" "}
          <a href="https://www.kaggle.com/datasets/adaoduque/campeonato-brasileiro-de-futebol" target="_blank" rel="noreferrer" className="underline">
            Kaggle: Campeonato Brasileiro de Futebol
          </a>
        </p>
      </section>

      <section id="treinamento" className="mt-10 scroll-mt-24">
        <TreinamentoProvider>
          <div className="grid gap-6 xl:grid-cols-2">
            <section>
              <h2 className="text-xl font-semibold">Treinamento</h2>
              <div className="mt-4">
                <TreinamentoContent />
              </div>
            </section>

            <section id="previsoes" className="scroll-mt-24">
              <h2 className="text-xl font-semibold">Previsões</h2>
              <div className="mt-4">
                <PrevisoesContent />
              </div>
            </section>

            <section className="xl:col-span-2">
              <TreinamentoChartsContent />
            </section>
          </div>
        </TreinamentoProvider>
      </section>

      <section id="exploracao" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Exploração</h2>
        <div className="mt-4">
          <ExploracaoContent />
        </div>
      </section>

      <section id="sobre-mim" className="mt-10 scroll-mt-24">
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

      <section id="aviso" className="mt-10 scroll-mt-24">
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

      <section id="ajuda" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Ajuda</h2>
        <div className="mt-4">
          <TreinamentoAjudaContent />
        </div>
      </section>
    </AppShell>
  );
}
