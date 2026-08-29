import type { PublicJob } from "@/types/ats";
import { formatMoney } from "@/lib/ats/offer-labels";

export function PublicJobContent({ job }: { job: PublicJob }) {
  return (
    <article className="space-y-6 rounded-xl border bg-card p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">{job.areaName}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {job.positionName || job.title}
        </h1>
        {job.salaryAmount ? (
          <p className="text-lg font-medium">
            {formatMoney(job.salaryAmount, job.salaryCurrency ?? "COP")}
          </p>
        ) : null}
      </div>
      <JobSection title="Misión / visión" body={job.mission} />
      <JobSection title="Responsabilidades" body={job.responsibilities} />
      <JobSection title="Experiencia" body={job.requiredExperience} />
      {job.description?.trim() ? (
        <JobSection title="Sobre la vacante" body={job.description} />
      ) : null}
    </article>
  );
}

function JobSection({ title, body }: { title: string; body?: string | null }) {
  const text = body?.trim();
  if (!text) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </section>
  );
}
