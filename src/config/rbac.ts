export const PERMISSIONS = [
  "dashboard.access",
  "orders.manage",
  "stock.manage",
  "catalog.edit",
  "masters.edit",
  "offers.edit",
  "content.edit",
  "catalog.delete",
  "shipping.config",
  "users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type StaffRole = "ADMIN" | "EDITOR" | "EMPLOYEE";

export const STAFF_ROLE_DEFINITIONS: {
  key: StaffRole;
  label: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    key: "ADMIN",
    label: "Administrador",
    description: "Acceso completo, incluida la gestión de usuarios y roles.",
    permissions: [...PERMISSIONS],
  },
  {
    key: "EDITOR",
    label: "Editor",
    description: "Gestiona catálogo, maestros, ofertas y contenido.",
    permissions: ["dashboard.access", "catalog.edit", "masters.edit", "offers.edit", "content.edit"],
  },
  {
    key: "EMPLOYEE",
    label: "Empleado",
    description: "Gestiona pedidos, envíos y movimientos de stock.",
    permissions: ["dashboard.access", "orders.manage", "stock.manage"],
  },
];

export const STAFF_ROLES: StaffRole[] = STAFF_ROLE_DEFINITIONS.map(({ key }) => key);

export function permissionsForRoles(roles: readonly string[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    const definition = STAFF_ROLE_DEFINITIONS.find((item) => item.key === role);
    definition?.permissions.forEach((permission) => permissions.add(permission));
  }
  return PERMISSIONS.filter((permission) => permissions.has(permission));
}

export function primaryStaffRole(roles: readonly string[]): StaffRole | null {
  return STAFF_ROLE_DEFINITIONS.find(({ key }) => roles.includes(key))?.key ?? null;
}
