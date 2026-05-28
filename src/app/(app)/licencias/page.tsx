import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { requireCurrentSession } from "@/lib/session";

import { createLicense, deleteLicense } from "../actions";

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
      </header>
      <article className="card">
        <div className="card-header">
          <h2>Nueva licencia</h2>
        </div>
        <form action={createLicense} className="card-body form-grid">
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
              <option value="ACTIVE">Activa</option>
              <option value="EXPIRING">Proxima a vencer</option>
              <option value="EXPIRED">Vencida</option>
              <option value="CANCELLED">Cancelada</option>
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
            Cuenta o contrato proveedor
            <input className="input" name="vendorAccount" placeholder="Tenant, contrato, reseller..." />
          </label>
          <label className="field wide">
            Notas
            <textarea className="input textarea" name="notes" placeholder="Condiciones, compra, contacto, observaciones..." />
          </label>
          <div className="form-actions wide">
            <button className="button" type="submit">Anadir licencia</button>
          </div>
        </form>
      </article>

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
                <th>Vencimiento</th>
                <th>Coste</th>
                <th>Contrato</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id}>
                  <td>{license.provider}</td>
                  <td>{license.product}</td>
                  <td>{license.seats}</td>
                  <td><StatusBadge value={license.status} /></td>
                  <td>{formatDate(license.renewalDate)}</td>
                  <td>{formatMoney(license.costCents, license.currency)}</td>
                  <td>{license.vendorAccount ?? "Sin dato"}</td>
                  <td>
                    <form action={deleteLicense}>
                      <input name="id" type="hidden" value={license.id} />
                      <button className="button danger compact" type="submit">Eliminar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
