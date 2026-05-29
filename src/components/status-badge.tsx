import clsx from "clsx";

const statusMap: Record<string, string> = {
  ACTIVE: "success",
  TRIAL: "info",
  EXPIRING: "warning",
  EXPIRED: "danger",
  ERROR: "danger",
  CRITICAL: "danger",
  WARNING: "warning",
  INFO: "info",
  DRAFT: "info",
  PAUSED: "warning",
  CANCELLED: "danger",
  SUSPENDED: "danger",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Activa",
  TRIAL: "Trial",
  EXPIRING: "Pendiente renovacion",
  EXPIRED: "Expirada",
  ERROR: "Error",
  CRITICAL: "Critico",
  WARNING: "Aviso",
  INFO: "Info",
  DRAFT: "Borrador",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
  SUSPENDED: "Suspendida",
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={clsx("badge", statusMap[value] ?? "info")}>{statusLabels[value] ?? value}</span>;
}
