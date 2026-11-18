/**
 * Roles y permisos del dashboard (RBAC).
 *
 * Los roles se guardan en SuperTokens (UserRoles); qué puede hacer cada rol se
 * define acá, en un solo lugar. El backend autoriza con `requirePermission()` y
 * el dashboard recibe los permisos del usuario en `GET /user/me` para mostrar
 * u ocultar secciones.
 *
 * Jerarquía: ADMIN ⊃ EDITOR ⊃ EMPLOYEE. Un usuario sin rol de staff es cliente.
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

const EMPLOYEE_PERMS: Permission[] = ["dashboard.access", "orders.manage", "stock.manage"];
const EDITOR_PERMS: Permission[] = [...EMPLOYEE_PERMS, "catalog.edit", "masters.edit", "offers.edit", "content.edit"];
const ADMIN_PERMS = Object.keys(PERMISSIONS) as Permission[];

export const ROLES = {
  ADMIN: {
    label: "Administrador",
    description: "Acceso total, incluida la gestión de usuarios y tarifas.",
    permissions: ADMIN_PERMS,
  },
  EDITOR: {
    label: "Editor",
    description: "Todo lo del empleado y además edita catálogo, precios, ofertas y contenido.",
    permissions: EDITOR_PERMS,
  },
  EMPLOYEE: {
    label: "Empleado",
    description: "Atiende órdenes, envíos y stock. Ve el catálogo sin editarlo.",
    permissions: EMPLOYEE_PERMS,
  },
} as const satisfies Record<string, { label: string; description: string; permissions: Permission[] }>;

export type StaffRole = keyof typeof ROLES;

/** De mayor a menor: el primero que tenga el usuario es su rol "principal". */
export const STAFF_ROLES = ["ADMIN", "EDITOR", "EMPLOYEE"] as StaffRole[];

export const isStaffRole = (r: unknown): r is StaffRole => typeof r === "string" && (STAFF_ROLES as string[]).includes(r);

export const permissionsFor = (roles: string[]): Permission[] => {
  const set = new Set<Permission>();
  for (const r of roles) if (isStaffRole(r)) ROLES[r].permissions.forEach((p) => set.add(p));
  return [...set];
};

/** Rol principal (el más alto) o null si es cliente. */
export const primaryRole = (roles: string[]): StaffRole | null => STAFF_ROLES.find((r) => roles.includes(r)) ?? null;
