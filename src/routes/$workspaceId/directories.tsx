import { createFileRoute } from "@tanstack/react-router";
import { Header } from "~/components/templates/Header";
import { DirectorySearchPanel } from "~/components/modules/DirectorySearchPanel";

export const Route = createFileRoute("/$workspaceId/directories")({
  component: DirectoriesPage,
});

function DirectoriesPage() {
  const { workspaceId } = Route.useParams();

  return (
    <>
      <Header
        title="Directories"
        subtitle="Find founders from Product Hunt, G2, Capterra, and more — then add them to your pipeline."
      />
      <div className="page-content">
        <DirectorySearchPanel orgId={workspaceId} />
      </div>
    </>
  );
}
