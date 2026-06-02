import { getAuditLogs, getAuditStats } from './actions'
import AuditLogClient from '@/components/modules/audit-log/audit-log-client'

export default async function AuditLogPage() {
  const [{ logs, total }, stats] = await Promise.all([
    getAuditLogs({ page: 1 }),
    getAuditStats(),
  ])

  return (
    <AuditLogClient
      initialLogs={logs}
      initialTotal={total}
      stats={stats}
    />
  )
}
