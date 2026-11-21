import { describe, expect, it, vi } from "vitest";
import { isStaffRole, permissionsFor, PERMISSIONS, primaryRole, ROLES } from "../src/config/rbac.js";
import { getActor, requirePermission, requirePermissionToWrite } from "../src/middleware/auth.middleware.js";

describe("roles y permisos", () => {
  it("jerarquía: EMPLOYEE ⊂ EDITOR ⊂ ADMIN", () => {
    const emp = new Set(ROLES.EMPLOYEE.permissions);
    const ed = new Set(ROLES.EDITOR.permissions);
    expect([...emp].every((p) => ed.has(p))).toBe(true);
    expect(ROLES.ADMIN.permissions).toEqual(Object.keys(PERMISSIONS));
  });

  it("solo ADMIN gestiona usuarios, tarifas y bajas", () => {
    for (const p of ["users.manage", "shipping.config", "catalog.delete", "payments.refund"] as const) {
      expect(permissionsFor(["EDITOR", "EMPLOYEE"])).not.toContain(p);
      expect(permissionsFor(["ADMIN"])).toContain(p);
    }
  });

  it("el empleado no edita catálogo", () => {
    expect(permissionsFor(["EMPLOYEE"])).not.toContain("catalog.edit");
    expect(permissionsFor(["EMPLOYEE"])).toContain("orders.manage");
  });

  it("roles desconocidos no dan permisos", () => {
    expect(permissionsFor(["CUSTOMER", "SUPERADMIN"])).toEqual([]);
    expect(isStaffRole("CUSTOMER")).toBe(false);
  });

  it("rol principal = el más alto", () => {
    expect(primaryRole(["EMPLOYEE", "ADMIN"])).toBe("ADMIN");
    expect(primaryRole(["CUSTOMER"])).toBeNull();
  });
});

const fakeRes = () => {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn(() => res);
  return res;
};
// Sesión ya validada y roles precargados: el middleware no consulta SuperTokens.
const fakeReq = (roles: string[], method = "GET") => ({ method, session: { getUserId: () => "u1" }, userRoles: roles });

describe("requirePermission", () => {
  const check = requirePermission("catalog.edit")[1];

  it("deja pasar con el permiso", async () => {
    const next = vi.fn();
    await check(fakeReq(["EDITOR"]), fakeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("403 sin el permiso", async () => {
    const next = vi.fn();
    const res = fakeRes();
    await check(fakeReq(["EMPLOYEE"]), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("requirePermissionToWrite solo exige el permiso en escrituras", async () => {
    const check = requirePermissionToWrite("offers.edit");
    const next = vi.fn();
    await check(fakeReq(["EMPLOYEE"], "GET"), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const res = fakeRes();
    await check(fakeReq(["EMPLOYEE"], "POST"), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("getActor: staff = tiene acceso al panel", () => {
    expect(getActor(fakeReq(["EMPLOYEE"])).isStaff).toBe(true);
    expect(getActor(fakeReq(["CUSTOMER"])).isStaff).toBe(false);
    expect(getActor({}).isStaff).toBe(false);
  });
});
