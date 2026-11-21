/**
 * Roles y permisos del dashboard. SuperTokens almacena los roles; este módulo
 * mantiene la política de autorización y el catálogo que recibe el dashboard.
 */
export const PERMISSIONS = {
  "dashboard.access": "Entrar al panel y ver catálogo, stock y estadísticas",
  "orders.manage": "Gestionar órdenes, envíos, reposición y carritos",
  "stock.manage": "Registrar movimientos de stock",
  "catalog.edit": "Editar productos, variantes, imágenes, descripciones y precios",
  "masters.edit": "Editar categorías, marcas, etiquetas y proveedores",
  "offers.edit": "Crear y editar ofertas",
  "content.edit": "Editar banners y moderar reseñas",
  "catalog.delete": "Dar de baja productos y cambiar productos de marca",
  "shipping.config": "Configurar tarifas de envío",
  "users.manage": "Ver usuarios y asignar roles",
  "payments.refund": "Devolver dinero a clientes por Mercado Pago",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type StaffRole = "ADMIN" | "EDITOR" | "EMPLOYEE";

const EMPLOYEE_PERMISSIONS: Permission[] = ["dashboard.access", "orders.manage", "stock.manage"];
const EDITOR_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  "catalog.edit",
  "masters.edit",
  "offers.edit",
  "content.edit",
];
const ADMIN_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const STAFF_ROLE_DEFINITIONS: {
  key: StaffRole;
  label: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    key: "ADMIN",
    label: "Administrador",
    description: "Acceso total, incluida la gestión de usuarios, tarifas y reintegros.",
    permissions: ADMIN_PERMISSIONS,
  },
  {
    key: "EDITOR",
    label: "Editor",
    description: "Gestiona catálogo, maestros, ofertas y contenido.",
    permissions: EDITOR_PERMISSIONS,
  },
  {
    key: "EMPLOYEE",
    label: "Empleado",
    description: "Gestiona pedidos, envíos y movimientos de stock.",
    permissions: EMPLOYEE_PERMISSIONS,
  },
];

export const ROLES = Object.fromEntries(
  STAFF_ROLE_DEFINITIONS.map(({ key, label, description, permissions }) => [
    key,
    { label, description, permissions },
  ]),
) as Record<StaffRole, { label: string; description: string; permissions: Permission[] }>;

export const STAFF_ROLES: StaffRole[] = STAFF_ROLE_DEFINITIONS.map(({ key }) => key);
export const isStaffRole = (role: unknown): role is StaffRole =>
  typeof role === "string" && STAFF_ROLES.includes(role as StaffRole);

export function permissionsFor(roles: readonly string[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    if (isStaffRole(role)) ROLES[role].permissions.forEach((permission) => permissions.add(permission));
  }
  return Object.keys(PERMISSIONS).filter((permission) => permissions.has(permission as Permission)) as Permission[];
}

export const permissionsForRoles = permissionsFor;

export function primaryRole(roles: readonly string[]): StaffRole | null {
  return STAFF_ROLES.find((role) => roles.includes(role)) ?? null;
}

export const primaryStaffRole = primaryRole;
