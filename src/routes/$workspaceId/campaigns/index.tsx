import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$workspaceId/campaigns/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/$workspaceId/campaigns/"!</div>
}
