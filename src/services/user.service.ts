import { randomBytes } from "node:crypto";
import supertokens from "supertokens-node";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import EmailVerification from "supertokens-node/recipe/emailverification";
import Session from "supertokens-node/recipe/session";
import UserRoles from "supertokens-node/recipe/userroles";
import { prisma as sharedPrisma } from "../config/prisma/client.js";
import {
  isStaffRole,
  permissionsFor,
  primaryRole,
  ROLES,
  STAFF_ROLE_DEFINITIONS,
  STAFF_ROLES,
  type StaffRole,
} from "../config/rbac.js";
import type { InviteContext } from "../config/supertokens/email.js";
import type { SignUpContext } from "../config/supertokens/supertokens.config.js";
import { accountLinkingEnabled } from "../config/supertokens/account-linking.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import type { Actor } from "../middleware/auth.middleware.js";
import { UserRepository } from "../repository/user.repository.js";
import { errInfo, getLogger } from "../config/logger.js";

const log = getLogger("users");
const TENANT = "public";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE_MAX = 100;

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
  private readonly userRepository: UserRepository;

  constructor(private readonly prisma: any = sharedPrisma) {
    this.userRepository = new UserRepository();
  }

  findOneBySupertokensId(supertokensId: string) {
    return this.userRepository.findOneBySupertokensId(supertokensId);
  }

  roleCatalog() {
    return STAFF_ROLE_DEFINITIONS;
  }

  private async staffRoleMap(): Promise<Map<string, StaffRole[]>> {
    const map = new Map<string, StaffRole[]>();
    for (const role of STAFF_ROLES) {
      const result: any = await UserRoles.getUsersThatHaveRole(TENANT, role);
      if (result.status !== "OK") throw new ConflictError(`No se pudo consultar el rol ${role}`);
      for (const id of result.users as string[]) map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }

  /** Prepara los roles de SuperTokens y sincroniza su espejo en la base. */
  async ensureRoles() {
    await this.ensureStaffRoles();
    const map = await this.staffRoleMap();
    for (const role of STAFF_ROLES) {
      const ids = [...map].filter(([, roles]) => primaryRole(roles) === role).map(([id]) => id);
      if (ids.length) {
        await this.prisma.user.updateMany({
          where: { supertokensId: { in: ids }, role: { not: role } },
          data: { role },
        });
      }
    }
    await this.prisma.user.updateMany({
      where: { supertokensId: { notIn: [...map.keys()] }, role: { not: "CONSUMER" } },
      data: { role: "CONSUMER" },
    });
  }

  async list(params: UserListParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const perPage = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(params.perPage) || 20));
    const role = params.role;
    if (role && role !== "CUSTOMER" && role !== "STAFF" && !isStaffRole(role)) {
      throw new ValidationError("Filtro de rol inválido");
    }
    const map = await this.staffRoleMap();
    const where: any = {};
    const words = (params.search ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
    if (words.length) {
      where.AND = words.map((word) => ({
        OR: [
          { email: { contains: word, mode: "insensitive" } },
          { name: { contains: word, mode: "insensitive" } },
        ],
      }));
    }
    if (role === "CUSTOMER") {
      where.supertokensId = { notIn: [...map.keys()] };
    } else if (isStaffRole(role)) {
      const ids = [...map].filter(([, roles]) => primaryRole(roles) === role).map(([id]) => id);
      where.supertokensId = { in: ids };
    } else if (role === "STAFF") {
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

    const known: { supertokensId: string }[] = await this.prisma.user.findMany({
      where: { supertokensId: { in: [...map.keys()] } },
      select: { supertokensId: true },
    });
    const counts: Record<string, number> = { total: await this.prisma.user.count(), STAFF: known.length };
    for (const { supertokensId } of known) {
      const currentRole = primaryRole(map.get(supertokensId) ?? []);
      if (currentRole) counts[currentRole] = (counts[currentRole] ?? 0) + 1;
    }
    counts.CUSTOMER = counts.total - known.length;

    return {
      content: rows.map((user: any) => this.present(user, map.get(user.supertokensId) ?? [])),
      page,
      perPage,
      total,
      counts,
    };
  }

  async detail(supertokensId: string) {
    const user = await this.prisma.user.findUnique({ where: { supertokensId }, select: USER_SELECT });
    if (!user) throw new NotFoundError("Usuario no encontrado");
    const roleResult: any = await UserRoles.getRolesForUser(TENANT, supertokensId);
    if (roleResult.status !== "OK") throw new ConflictError("No se pudieron consultar los roles de la cuenta");
    const authUser = await supertokens.getUser(supertokensId);
    const lastOrder = await this.prisma.order.findFirst({
      where: { userSuperTokensId: supertokensId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, createdAt: true, status: true },
    });
    return {
      ...this.present(user, roleResult.roles),
      loginMethods: [...new Set((authUser?.loginMethods ?? []).map((method) =>
        method.recipeId === "thirdparty" ? method.thirdParty?.id ?? "thirdparty" : method.recipeId,
      ))],
      lastOrder,
    };
  }

  private present(user: any, roles: string[]) {
    const role = primaryRole(roles);
    return {
      id: user.id,
      supertokensId: user.supertokensId,
      email: user.email,
      name: user.name?.trim() || null,
      avatarUrl: user.avatarUrl || null,
      createdAt: user.createdAt,
      ordersCount: user._count?.orders ?? 0,
      role,
      roles,
      permissions: permissionsFor(roles),
    };
  }

  private parseRole(role: unknown): StaffRole | null {
    if (role === null || role === "" || role === "CUSTOMER") return null;
    if (!isStaffRole(role)) {
      throw new ValidationError(`Rol inválido. Opciones: ${STAFF_ROLES.join(", ")} o CUSTOMER`);
    }
    return role;
  }

  async setRole(actor: Actor, supertokensId: string, rawRole: unknown) {
    const role = this.parseRole(rawRole);
    if (supertokensId === actor.userId) {
      throw new ConflictError("No podés cambiar tu propio rol: pedíselo a otro administrador");
    }
    const user = await this.prisma.user.findUnique({ where: { supertokensId }, select: { id: true } });
    if (!user) throw new NotFoundError("Usuario no encontrado");
    await this.ensureStaffRoles();

    const currentResult: any = await UserRoles.getRolesForUser(TENANT, supertokensId);
    if (currentResult.status !== "OK") throw new ConflictError("No se pudieron consultar los roles de la cuenta");
    const current: string[] = currentResult.roles;
    if (current.includes("ADMIN") && role !== "ADMIN") {
      const admins: any = await UserRoles.getUsersThatHaveRole(TENANT, "ADMIN");
      if (admins.status !== "OK") throw new ConflictError("No se pudo verificar que exista otro administrador");
      if (admins.users.length <= 1) throw new ConflictError("Tiene que quedar al menos un administrador");
    }

    await this.replaceStaffRoles(supertokensId, role, current);
    await Session.revokeAllSessionsForUser(supertokensId, true, TENANT);
    return this.detail(supertokensId);
  }

  async revokeSessions(actor: Actor, supertokensId: string) {
    if (supertokensId === actor.userId) throw new ConflictError('Para cerrar tu sesión usá "Cerrar sesión"');
    const user = await this.prisma.user.findUnique({ where: { supertokensId }, select: { id: true } });
    if (!user) throw new NotFoundError("Usuario no encontrado");
    const revoked = await Session.revokeAllSessionsForUser(supertokensId, true, TENANT);
    return { revoked: revoked.length };
  }

  async invite(actor: Actor, input: { email?: unknown; name?: unknown; role?: unknown }) {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) throw new ValidationError("Ingresá un email válido");
    const name = String(input.name ?? "").trim().slice(0, 120);
    const role = this.parseRole(input.role);
    if (!role) throw new ValidationError("Elegí el rol que va a tener en el panel");
    await this.ensureStaffRoles();

    const existing = await supertokens.listUsersByAccountInfo(TENANT, { email });
    const withPassword = existing.find((user) => user.loginMethods.some((method) => method.recipeId === "emailpassword"));
    const target = withPassword ?? (accountLinkingEnabled() ? existing[0] : undefined);
    if (target) {
      await this.prisma.user.upsert({
        where: { supertokensId: target.id },
        update: {},
        create: { supertokensId: target.id, email, name },
      });
      const user = await this.setRole(actor, target.id, role);
      const passwordMethod = target.loginMethods.find((method) => method.recipeId === "emailpassword");
      const verification = passwordMethod && !passwordMethod.verified
        ? await this.sendVerification(target.id, passwordMethod.recipeUserId, email)
        : { verificationEmailSent: false, verificationLink: null };
      if (passwordMethod) return { user, created: false, emailSent: false, inviteLink: null, ...verification };

      const method = target.loginMethods[0];
      if (!method) throw new ConflictError("La cuenta no tiene un método de ingreso válido");
      const invitation = await this.sendInvite(target.id, method.recipeUserId, email, role, true);
      return { user, created: false, ...invitation, ...verification };
    }

    const password = `${randomBytes(24).toString("base64url")}aA1!`;
    const context: SignUpContext = { skipVerificationEmail: true };
    const signUp = await EmailPassword.signUp(TENANT, email, password, undefined, context);
    if (signUp.status !== "OK") throw new ConflictError(`No se pudo crear la cuenta (${signUp.status})`);
    const id = signUp.user.id;
    if (name) await this.prisma.user.update({ where: { supertokensId: id }, data: { name } });

    const assigned = await UserRoles.addRoleToUser(TENANT, id, role);
    if (assigned.status !== "OK") throw new ConflictError(`No se pudo asignar el rol ${role}`);
    await this.prisma.user.update({ where: { supertokensId: id }, data: { role } });

    const [invitation, verification] = await Promise.all([
      this.sendInvite(id, signUp.recipeUserId, email, role, false),
      this.sendVerification(id, signUp.recipeUserId, email),
    ]);
    return { user: await this.detail(id), created: true, ...invitation, ...verification };
  }

  private async sendVerification(id: string, recipeUserId: any, email: string) {
    let verificationEmailSent = false;
    let verificationLink: string | null = null;
    try {
      const result = await EmailVerification.sendEmailVerificationEmail(TENANT, id, recipeUserId, email);
      verificationEmailSent = result.status === "OK";
    } catch (error) {
      log.warn(errInfo(error), "No se pudo mandar la verificación de email");
    }
    if (!verificationEmailSent) {
      const link = await EmailVerification.createEmailVerificationLink(TENANT, recipeUserId, email);
      if (link.status !== "OK") throw new ConflictError("No se pudo crear el enlace para verificar el email");
      verificationLink = link.link;
    }
    return { verificationEmailSent, verificationLink };
  }

  private async sendInvite(id: string, recipeUserId: any, email: string, role: StaffRole, google: boolean) {
    const link = await EmailPassword.createResetPasswordLink(TENANT, id, email);
    const inviteLink = link.status === "OK" ? link.link : null;
    let emailSent = false;
    if (inviteLink) {
      const context: InviteContext = {
        invite: { roleLabel: ROLES[role].label, dashboardUrl: process.env.DASHBOARD_URL || undefined, google },
      };
      try {
        await EmailPassword.sendEmail({
          type: "PASSWORD_RESET",
          passwordResetLink: inviteLink,
          user: { id, recipeUserId, email },
          tenantId: TENANT,
          userContext: context,
        });
        emailSent = true;
      } catch (error) {
        log.warn(errInfo(error), "No se pudo mandar la invitación");
      }
    }
    return { inviteLink, emailSent };
  }

  private async ensureStaffRoles() {
    for (const role of STAFF_ROLE_DEFINITIONS) {
      const result = await UserRoles.createNewRoleOrAddPermissions(role.key, role.permissions);
      if (result.status !== "OK") throw new ConflictError(`No se pudo preparar el rol ${role.key}`);
    }
  }

  private async replaceStaffRoles(userId: string, role: StaffRole | null, currentRoles: string[]) {
    const staffRoles = currentRoles.filter((item) => STAFF_ROLES.includes(item as StaffRole));
    const removedRoles: string[] = [];
    let targetRoleAdded = false;
    try {
      for (const existingRole of staffRoles) {
        if (existingRole === role) continue;
        const result = await UserRoles.removeUserRole(TENANT, userId, existingRole);
        if (result.status !== "OK") throw new ConflictError(`No se pudo quitar el rol ${existingRole}`);
        removedRoles.push(existingRole);
      }
      if (role && !staffRoles.includes(role)) {
        const result = await UserRoles.addRoleToUser(TENANT, userId, role);
        if (result.status !== "OK") throw new ConflictError(`No se pudo asignar el rol ${role}`);
        targetRoleAdded = true;
      }
      await this.prisma.user.update({
        where: { supertokensId: userId },
        data: { role: role ?? "CONSUMER" },
      });
    } catch (error) {
      let rollbackFailed = false;
      if (targetRoleAdded && role) {
        const result = await UserRoles.removeUserRole(TENANT, userId, role);
        rollbackFailed ||= result.status !== "OK";
      }
      for (const removedRole of removedRoles) {
        const result = await UserRoles.addRoleToUser(TENANT, userId, removedRole);
        rollbackFailed ||= result.status !== "OK";
      }
      if (rollbackFailed) {
        throw new ConflictError("Falló el cambio de rol y no se pudo restaurar por completo el acceso anterior");
      }
      throw error;
    }
  }
}
