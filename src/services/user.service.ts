import { randomBytes } from "node:crypto";
import supertokens from "supertokens-node";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Session from "supertokens-node/recipe/session";
import UserRoles from "supertokens-node/recipe/userroles";
import { prisma as sharedPrisma } from "../config/prisma/client.js";
import { isStaffRole, permissionsFor, primaryRole, ROLES, STAFF_ROLES, type StaffRole } from "../config/rbac.js";
import type { InviteContext } from "../config/supertokens/email.js";
import type { SignUpContext } from "../config/supertokens/supertokens.config.js";
import { accountLinkingEnabled } from "../config/supertokens/account-linking.js";
import { UserRepository } from "../repository/user.repository.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import type { Actor } from "../middleware/auth.middleware.js";
import { getLogger, errInfo } from "../config/logger.js";

const log = getLogger("users");

const TENANT = "public";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "CUSTOMER" en el filtro = sin rol de staff. */
export type RoleFilter = StaffRole | "CUSTOMER";

export type UserListParams = { search?: string; role?: string; page?: number; perPage?: number };

const USER_SELECT = {
  id: true,
  supertokensId: true,
  email: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
  _count: { select: { orders: true } },
} as const;

export class UserService {
  protected userRepository: UserRepository;
  constructor(private readonly prisma: any = sharedPrisma) {
    this.userRepository = new UserRepository();
  }

  async findOneBySupertokensId(supertokensId: string) {
    return this.userRepository.findOneBySupertokensId(supertokensId);
  }

  // ------------------------------------------------------------ Roles

  /** Definición de roles y permisos (para la pantalla de usuarios). */
  roleCatalog() {
    return STAFF_ROLES.map((key) => ({ key, ...ROLES[key] }));
  }

  /** Quién tiene cada rol de staff, según SuperTokens (la fuente de verdad). */
  private async staffRoleMap(): Promise<Map<string, StaffRole[]>> {
    const map = new Map<string, StaffRole[]>();
    for (const role of STAFF_ROLES) {
      const res: any = await UserRoles.getUsersThatHaveRole(TENANT, role);
      if (res.status !== "OK") continue;
      for (const id of res.users as string[]) map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }

  /**
   * Al arrancar: crea los roles que falten en SuperTokens y alinea el espejo
   * `User.role` de la base (sirve para reportes; la autorización usa SuperTokens).
   */
  async ensureRoles() {
    for (const role of STAFF_ROLES) await UserRoles.createNewRoleOrAddPermissions(role, []);
    const map = await this.staffRoleMap();
    for (const role of STAFF_ROLES) {
      const ids = [...map].filter(([, roles]) => primaryRole(roles) === role).map(([id]) => id);
      if (ids.length) {
        await this.prisma.user.updateMany({ where: { supertokensId: { in: ids }, role: { not: role } }, data: { role } });
      }
    }
    await this.prisma.user.updateMany({
      where: { supertokensId: { notIn: [...map.keys()] }, role: { not: "CONSUMER" } },
      data: { role: "CONSUMER" },
    });
  }

  // ------------------------------------------------------------ Listado

  async list(params: UserListParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(params.perPage) || 20));
    const map = await this.staffRoleMap();

    const where: any = {};
    const words = (params.search ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
    if (words.length) {
      where.AND = words.map((w) => ({
        OR: [{ email: { contains: w, mode: "insensitive" } }, { name: { contains: w, mode: "insensitive" } }],
      }));
    }
    if (params.role === "CUSTOMER") {
      where.supertokensId = { notIn: [...map.keys()] };
    } else if (isStaffRole(params.role)) {
      const ids = [...map].filter(([, roles]) => primaryRole(roles) === params.role).map(([id]) => id);
      where.supertokensId = { in: ids };
    } else if (params.role === "STAFF") {
      where.supertokensId = { in: [...map.keys()] };
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Conteos solo sobre usuarios que existen en la base (SuperTokens puede tener ids sueltos).
    const known: { supertokensId: string }[] = await this.prisma.user.findMany({
      where: { supertokensId: { in: [...map.keys()] } },
      select: { supertokensId: true },
    });
    const counts: Record<string, number> = { total: await this.prisma.user.count(), STAFF: known.length };
    for (const { supertokensId } of known) {
      const r = primaryRole(map.get(supertokensId) ?? []);
      if (r) counts[r] = (counts[r] ?? 0) + 1;
    }
    counts.CUSTOMER = counts.total - known.length;

    return {
      content: rows.map((u: any) => this.present(u, map.get(u.supertokensId) ?? [])),
      page,
      perPage,
      total,
      counts,
    };
  }

  async detail(supertokensId: string) {
    const user = await this.prisma.user.findUnique({ where: { supertokensId }, select: USER_SELECT });
    if (!user) throw new NotFoundError("Usuario no encontrado");
    const { roles } = await UserRoles.getRolesForUser(TENANT, supertokensId);
    const stUser = await supertokens.getUser(supertokensId);
    const lastOrder = await this.prisma.order.findFirst({
      where: { userSuperTokensId: supertokensId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, status: true },
    });
    return {
      ...this.present(user, roles),
      loginMethods: stUser?.loginMethods.map((m) => (m.recipeId === "thirdparty" ? m.thirdParty?.id ?? "social" : "email")) ?? [],
      lastOrder,
    };
  }

  private present(u: any, roles: string[]) {
    const role = primaryRole(roles);
    return {
      id: u.id,
      supertokensId: u.supertokensId,
      email: u.email,
      name: u.name?.trim() || null,
      avatarUrl: u.avatarUrl || null,
      createdAt: u.createdAt,
      ordersCount: u._count?.orders ?? 0,
      role,
      roles,
      permissions: permissionsFor(roles),
    };
  }

  // ------------------------------------------------------------ Cambios

  private parseRole(role: unknown): StaffRole | null {
    if (role === null || role === "" || role === "CUSTOMER") return null;
    if (!isStaffRole(role)) throw new ValidationError(`Rol inválido. Opciones: ${STAFF_ROLES.join(", ")} o CUSTOMER`);
    return role;
  }

  /** Asigna un rol de staff (o lo quita con `null`). Un usuario tiene un solo rol de staff. */
  async setRole(actor: Actor, supertokensId: string, rawRole: unknown) {
    const role = this.parseRole(rawRole);
    if (supertokensId === actor.userId) {
      throw new ConflictError("No podés cambiar tu propio rol: pedíselo a otro administrador");
    }
    const user = await this.prisma.user.findUnique({ where: { supertokensId }, select: { id: true } });
    if (!user) throw new NotFoundError("Usuario no encontrado");

    const { roles: current } = await UserRoles.getRolesForUser(TENANT, supertokensId);
    if (current.includes("ADMIN") && role !== "ADMIN") {
      const admins: any = await UserRoles.getUsersThatHaveRole(TENANT, "ADMIN");
      if (admins.status === "OK" && admins.users.length <= 1) {
        throw new ConflictError("Tiene que quedar al menos un administrador");
      }
    }

    for (const r of current) {
      if (isStaffRole(r) && r !== role) await UserRoles.removeUserRole(TENANT, supertokensId, r);
    }
    if (role && !current.includes(role)) {
      const res = await UserRoles.addRoleToUser(TENANT, supertokensId, role);
      if (res.status !== "OK") throw new ConflictError(`No se pudo asignar el rol (${res.status})`);
    }
    await this.prisma.user.update({ where: { supertokensId }, data: { role: role ?? "CONSUMER" } });
    return this.detail(supertokensId);
  }

  /** Cierra todas las sesiones del usuario (tiene que volver a ingresar). */
  async revokeSessions(actor: Actor, supertokensId: string) {
    if (supertokensId === actor.userId) throw new ConflictError("Para cerrar tu sesión usá \"Cerrar sesión\"");
    const user = await this.prisma.user.findUnique({ where: { supertokensId }, select: { id: true } });
    if (!user) throw new NotFoundError("Usuario no encontrado");
    const revoked = await Session.revokeAllSessionsForUser(supertokensId);
    return { revoked: revoked.length };
  }

  /**
   * Invita a alguien al panel: si el email no tiene cuenta, se crea con una
   * contraseña aleatoria y se le manda el mail para elegir la suya. Si ya tiene
   * cuenta (por ejemplo, es cliente), solo se le asigna el rol.
   */
  async invite(actor: Actor, input: { email?: unknown; name?: unknown; role?: unknown }) {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) throw new ValidationError("Ingresá un email válido");
    const name = String(input.name ?? "").trim().slice(0, 120);
    const role = this.parseRole(input.role);
    if (!role) throw new ValidationError("Elegí el rol que va a tener en el panel");

    const existing = await supertokens.listUsersByAccountInfo(TENANT, { email });
    const withPassword = existing.find((u) => u.loginMethods.some((m) => m.recipeId === "emailpassword"));
    // Con account linking la cuenta de Google ES la persona: el rol va ahí (si no,
    // al vincularse quedaría en una cuenta secundaria). Sin linking, el panel
    // necesita una cuenta de email aparte.
    const target = withPassword ?? (accountLinkingEnabled() ? existing[0] : undefined);
    if (target) {
      const id = target.id;
      // La cuenta existe en SuperTokens pero quizás no en la base (cuentas viejas).
      await this.prisma.user.upsert({
        where: { supertokensId: id },
        update: {},
        create: { supertokensId: id, email, name },
      });
      const user = await this.setRole(actor, id, role);
      if (withPassword) return { user, created: false, emailSent: false, inviteLink: null };
      // Solo Google: puede entrar con Google ya mismo; el enlace le agrega una contraseña.
      const recipeUserId = target.loginMethods[0].recipeUserId;
      const { inviteLink, emailSent } = await this.sendInvite(id, recipeUserId, email, role, true);
      return { user, created: false, emailSent, inviteLink };
    }

    const password = randomBytes(24).toString("base64url") + "aA1!";
    const ctx: SignUpContext = { skipVerificationEmail: true }; // la invitación ya verifica el email
    const signUp = await EmailPassword.signUp(TENANT, email, password, undefined, ctx);
    if (signUp.status !== "OK") throw new ConflictError(`No se pudo crear la cuenta (${signUp.status})`);
    const id = signUp.user.id;
    if (name) await this.prisma.user.update({ where: { supertokensId: id }, data: { name } });
    await UserRoles.addRoleToUser(TENANT, id, role);
    await this.prisma.user.update({ where: { supertokensId: id }, data: { role } });

    const { inviteLink, emailSent } = await this.sendInvite(id, signUp.recipeUserId, email, role, false);
    return { user: await this.detail(id), created: true, emailSent, inviteLink };
  }

  /** Enlace de "elegir contraseña" + mail de invitación. `google`: ya puede entrar con Google. */
  private async sendInvite(id: string, recipeUserId: any, email: string, role: StaffRole, google: boolean) {
    const link = await EmailPassword.createResetPasswordLink(TENANT, id, email);
    const inviteLink = link.status === "OK" ? link.link : null;
    let emailSent = false;
    if (inviteLink) {
      const ctx: InviteContext = {
        invite: { roleLabel: ROLES[role].label, dashboardUrl: process.env.DASHBOARD_URL || undefined, google },
      };
      try {
        await EmailPassword.sendEmail({
          type: "PASSWORD_RESET",
          passwordResetLink: inviteLink,
          user: { id, recipeUserId, email },
          tenantId: TENANT,
          userContext: ctx,
        });
        emailSent = true;
      } catch (err: any) {
        log.warn(errInfo(err), "No se pudo mandar la invitación");
      }
    }
    return { inviteLink, emailSent };
  }
}
