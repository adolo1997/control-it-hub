import { LicenseStatusSelect } from "@/components/license-status-select";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { requireCurrentSession } from "@/lib/session";

import { createLicense, deleteLicense, updateLicense } from "../actions";

const editableLicenseStatuses = [
  { value: "ACTIVE", label: "Activa" },
  { value: "EXPIRING", label: "Pendiente renovacion" },
  { value: "EXPIRED", label: "Expirada" },
];

function dateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function moneyInputValue(cents: number | null) {
  return typeof cents === "number" ? (cents / 100).toFixed(2) : "";
}

function visibleLicenseStatus(status: string, renewalDate: Date | null) {
  if (!renewalDate || status === "EXPIRED") {
    return status === "CANCELLED" ? "EXPIRED" : (status as "ACTIVE" | "EXPIRING" | "EXPIRED");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setMonth(limit.getMonth() + 1);

  if (renewalDate < today) {
    return "EXPIRED";
  }

  if (renewalDate <= limit) {
    return "EXPIRING";
  }

  return status === "CANCELLED" ? "EXPIRED" : (status as "ACTIVE" | "EXPIRING" | "EXPIRED");
}

export default async function LicenciasPage() {
  const session = await requireCurrentSession();
  const licenses = await db.license.findMany({
    where: { companyId: session.company.id },
    orderBy: [{ renewalDate: "asc" }, { provider: "asc" }],
  });

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Licencias</h1>
          <p className="muted">Compras, renovaciones, costes y vencimientos.</p>
        </div>
        <Modal title="Anadir licencia" triggerLabel="Anadir licencia">
          <form action={createLicense} className="modal-body form-grid">
            <label className="field">
              Proveedor
              <input className="input" name="provider" placeholder="Microsoft, PRTG, Veeam..." required />
            </label>
            <label className="field">
              Producto
              <input className="input" name="product" placeholder="Microsoft 365 Business Premium" required />
            </label>
            <label className="field">
              Seats
              <input className="input" min="1" name="seats" type="number" defaultValue="1" required />
            </label>
            <label className="field">
              Estado
              <select className="input" name="status" defaultValue="ACTIVE">
                {editableLicenseStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Fecha de compra
              <input className="input" name="purchaseDate" type="date" />
            </label>
            <label className="field">
              Vencimiento
              <input className="input" name="renewalDate" type="date" />
            </label>
            <label className="field">
              Coste
              <input className="input" inputMode="decimal" name="cost" placeholder="99.95" />
            </label>
            <label className="field">
              Moneda
              <input className="input" maxLength={3} name="currency" defaultValue="EUR" />
            </label>
            <label className="field wide">
              Notas
              <textarea className="input textarea" name="notes" placeholder="Condiciones, compra, contacto, observaciones..." />
            </label>
            <div className="form-actions wide">
              <button className="button" type="submit">Guardar licencia</button>
            </div>
          </form>
        </Modal>
      </header>

      <article className="card">
        <div className="card-header">
          <h2>Licencias registradas</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Producto</th>
                <th>Seats</th>
                <th>Estado</th>
                <th>Compra</th>
                <th>Vencimiento</th>
                <th>Coste</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => {
                const visibleStatus = visibleLicenseStatus(license.status, license.renewalDate);

                return (
                  <tr key={license.id}>
                    <td>{license.provider}</td>
                    <td>{license.product}</td>
                    <td>{license.seats}</td>
                    <td>
                      <div className="status-stack">
                        <StatusBadge value={visibleStatus} />
                        <LicenseStatusSelect id={license.id} status={visibleStatus} />
                      </div>
                    </td>
                    <td>{formatDate(license.purchaseDate)}</td>
                    <td>{formatDate(license.renewalDate)}</td>
                    <td>{formatMoney(license.costCents, license.currency)}</td>
                    <td>
                      <div className="actions-cell">
                        <Modal
                          title={`Editar ${license.product}`}
                          triggerClassName="button secondary compact"
                          triggerLabel="Editar"
                        >
                          <form action={updateLicense} className="modal-body form-grid">
                            <input name="id" type="hidden" value={license.id} />
                            <label className="field">
                              Proveedor
                              <input className="input" name="provider" defaultValue={license.provider} required />
                            </label>
                            <label className="field">
                              Producto
                              <input className="input" name="product" defaultValue={license.product} required />
                            </label>
                            <label className="field">
                              Seats
                              <input className="input" min="1" name="seats" type="number" defaultValue={license.seats} required />
                            </label>
                            <label className="field">
                              Estado
                              <select className="input" name="status" defaultValue={visibleStatus}>
                                {editableLicenseStatuses.map((status) => (
                                  <option key={status.value} value={status.value}>
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              Fecha de compra
                              <input className="input" name="purchaseDate" type="date" defaultValue={dateInputValue(license.purchaseDate)} />
                            </label>
                            <label className="field">
                              Vencimiento
                              <input className="input" name="renewalDate" type="date" defaultValue={dateInputValue(license.renewalDate)} />
                            </label>
                            <label className="field">
                              Coste
                              <input className="input" inputMode="decimal" name="cost" defaultValue={moneyInputValue(license.costCents)} />
                            </label>
                            <label className="field">
                              Moneda
                              <input className="input" maxLength={3} name="currency" defaultValue={license.currency} />
                            </label>
                            <label className="field wide">
                              Notas
                              <textarea className="input textarea" name="notes" defaultValue={license.notes ?? ""} />
                            </label>
                            <div className="form-actions wide">
                              <button className="button" type="submit">Guardar cambios</button>
                            </div>
                          </form>
                        </Modal>
                        <form action={deleteLicense}>
                          <input name="id" type="hidden" value={license.id} />
                          <button className="button danger compact" type="submit">Eliminar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
