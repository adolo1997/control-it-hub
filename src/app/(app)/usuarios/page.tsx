import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireCurrentSession } from "@/lib/session";

import { createUserWithMembership, removeMembership } from "../actions";

export default async function UsuariosPage() {
  const session = await requireCurrentSession();
  const canManageUsers = ["OWNER", "ADMIN"].includes(session.membershipRole);
  const companyFilter = session.platformRole === "SUPER_ADMIN" ? undefined : session.company.id;

  const [companies, memberships] = await Promise.all([
    db.company.findMany({
      where: session.platformRole === "SUPER_ADMIN" ? undefined : { id: session.company.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
    db.membership.findMany({
      where: companyFilter ? { companyId: companyFilter } : undefined,
      orderBy: [{ company: { name: "asc" } }, { user: { email: "asc" } }],
      include: {
        company: true,
        user: true,
      },
    }),
  ]);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Usuarios</h1>
          <p className="muted">Altas, accesos y permisos por empresa.</p>
        </div>
        {canManageUsers ? (
          <Modal title="Anadir usuario" triggerLabel="Anadir usuario">
            <form action={createUserWithMembership} className="modal-body form-grid">
              <label className="field">
                Nombre
                <input className="input" name="name" placeholder="Nombre del usuario" required />
              </label>
              <label className="field">
                Email
                <input className="input" name="email" type="email" placeholder="usuario@empresa.com" required />
              </label>
              <label className="field">
                Password inicial
                <input className="input" name="password" type="password" minLength={8} required />
              </label>
              <label className="field">
                Empresa
                <select className="input" name="companyId" defaultValue={session.company.id}>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Rol en empresa
                <select className="input" name="role" defaultValue="VIEWER">
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                  <option value="TECH">Tecnico</option>
                  <option value="BILLING">Facturacion</option>
                  <option value="VIEWER">Solo lectura</option>
                </select>
              </label>
              {session.platformRole === "SUPER_ADMIN" ? (
                <label className="field">
                  Rol plataforma
                  <select className="input" name="platformRole" defaultValue="USER">
                    <option value="USER">Usuario</option>
                    <option value="SUPER_ADMIN">Super admin</option>
                  </select>
                </label>
              ) : (
                <input name="platformRole" type="hidden" value="USER" />
              )}
              <div className="form-actions wide">
                <button className="button" type="submit">Guardar usuario</button>
              </div>
            </form>
          </Modal>
        ) : null}
      </header>

      <article className="card">
        <div className="card-header">
          <h2>Accesos registrados</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Empresa</th>
                <th>Rol empresa</th>
                <th>Rol plataforma</th>
                <th>Estado</th>
                <th>Ultimo login</th>
                {canManageUsers ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id}>
                  <td>{membership.user.name}</td>
                  <td>{membership.user.email}</td>
                  <td>{membership.company.name}</td>
                  <td>{membership.role}</td>
                  <td>{membership.user.platformRole}</td>
                  <td>
                    <StatusBadge value={membership.user.isActive ? "ACTIVE" : "SUSPENDED"} />
                  </td>
                  <td>{formatDate(membership.user.lastLoginAt)}</td>
                  {canManageUsers ? (
                    <td>
                      {membership.userId === session.user.id && membership.companyId === session.company.id ? (
                        <span className="muted">Sesion actual</span>
                      ) : (
                        <form action={removeMembership}>
                          <input name="id" type="hidden" value={membership.id} />
                          <button className="button danger compact" type="submit">Quitar acceso</button>
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
