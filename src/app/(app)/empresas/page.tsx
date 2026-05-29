import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { requireCurrentSession } from "@/lib/session";

import { createCompany, deleteCompany } from "../actions";

export default async function EmpresasPage() {
  const session = await requireCurrentSession();
  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          memberships: true,
          licenses: true,
          integrations: true,
        },
      },
    },
  });

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Empresas</h1>
          <p className="muted">Base multiempresa para vender el servicio por cliente o division.</p>
        </div>
        {session.platformRole === "SUPER_ADMIN" ? (
          <Modal title="Anadir empresa" triggerLabel="Anadir empresa">
            <form action={createCompany} className="modal-body form-grid">
              <label className="field">
                Nombre
                <input className="input" name="name" placeholder="Cliente o division" required />
              </label>
              <label className="field">
                CIF/NIF
                <input className="input" name="taxId" placeholder="Opcional" />
              </label>
              <label className="field">
                Estado
                <select className="input" name="status" defaultValue="ACTIVE">
                  <option value="ACTIVE">Activa</option>
                  <option value="TRIAL">Trial</option>
                  <option value="SUSPENDED">Suspendida</option>
                </select>
              </label>
              <label className="field">
                Plan
                <input className="input" name="plan" defaultValue="starter" required />
              </label>
              <div className="form-actions wide">
                <button className="button" type="submit">Crear empresa</button>
              </div>
            </form>
          </Modal>
        ) : null}
      </header>

      <article className="card">
        <div className="card-header">
          <h2>Empresas registradas</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Usuarios</th>
                <th>Licencias</th>
                <th>Integraciones</th>
                {session.platformRole === "SUPER_ADMIN" ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.plan}</td>
                  <td><StatusBadge value={company.status} /></td>
                  <td>{company._count.memberships}</td>
                  <td>{company._count.licenses}</td>
                  <td>{company._count.integrations}</td>
                  {session.platformRole === "SUPER_ADMIN" ? (
                    <td>
                      {company.id === session.company.id ? (
                        <span className="muted">Empresa actual</span>
                      ) : (
                        <form action={deleteCompany}>
                          <input name="id" type="hidden" value={company.id} />
                          <button className="button danger compact" type="submit">Eliminar</button>
                        </form>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
