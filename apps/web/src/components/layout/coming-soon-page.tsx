import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type ComingSoonPageProps = {
  title: string;
  description: string;
};

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Próximamente"
        description="Esta sección estará disponible en una fase posterior. La navegación ya queda lista."
      />
    </div>
  );
}
