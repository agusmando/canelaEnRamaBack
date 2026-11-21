import crypto from "node:crypto";
import supertokens from "supertokens-node";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import EmailVerification from "supertokens-node/recipe/emailverification";
import Session from "supertokens-node/recipe/session";
import UserRoles from "supertokens-node/recipe/userroles";
import { prisma } from "../config/prisma/client.js";
import {
  permissionsForRoles,
  primaryStaffRole,
  STAFF_ROLE_DEFINITIONS,
  STAFF_ROLES,
  type StaffRole,
} from "../config/rbac.js";
import { ConflictError } from "../errors/application/ConflictError.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { UserRepository } from "../repository/user.repository.js";

const TENANT_ID = "public";
const PAGE_SIZE_MAX = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type UserRoleFilter = "STAFF" | "ADMIN" | "EDITOR" | "EMPLOYEE" | "CUSTOMER";

export class UserService {
  protected userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async findOneBySupertokensId(supertokensId: string) {
    return this.userRepository.findOneBySupertokensId(supertokensId);
  }

  async list(page = 1, amountPerPage = 20, search = "", role?: UserRoleFilter) {
    const currentPage = Math.max(1, Number(page) || 1);
    const perPage = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(amountPerPage) || 20));
    const users = await prisma.user.findMany({
      include: { _count: { select: { orders: true } } },
      orderBy: { id: "desc" },
    });
    const records = await Promise.all(
      users.map(async (user) => {
        const { roles } = await UserRoles.getRolesForUser(TENANT_ID, user.supertokensId);
        return this.toManagedUser(user, roles);
      }),
    );
    const query = search.trim().toLocaleLowerCase("es");
    const filtered = records.filter((user) => {
      const matchesSearch =
        !query ||
        user.name?.toLocaleLowerCase("es").includes(query) ||
        user.email?.toLocaleLowerCase("es").includes(query);
      const matchesRole =
        !role ||
        (role === "STAFF" ? !!user.role : role === "CUSTOMER" ? !user.role : user.role === role);
      return matchesSearch && matchesRole;
    });
    const counts = records.reduce(
      (result, user) => {
        result.total += 1;
        if (user.role) {
          result.STAFF += 1;
          result[user.role] += 1;
        } else {
          result.CUSTOMER += 1;
        }
        return result;
      },
      { total: 0, STAFF: 0, ADMIN: 0, EDITOR: 0, EMPLOYEE: 0, CUSTOMER: 0 },
    );
    const offset = (currentPage - 1) * perPage;
    return {
      content: filtered.slice(offset, offset + perPage),
      pagination: { page: currentPage, amountPerPage: perPage, totalAmount: filtered.length },
      counts,
    };
  }

  async detail(supertokensId: string) {
    const user = await prisma.user.findUnique({
      where: { supertokensId },
      include: { _count: { select: { orders: true } } },
    });
    if (!user) throw new NotFoundError("User not found");
    const [rolesResponse, authUser, lastOrder] = await Promise.all([
      UserRoles.getRolesForUser(TENANT_ID, supertokensId),
      supertokens.getUser(supertokensId),
      prisma.order.findFirst({
        where: { userSuperTokensId: supertokensId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, createdAt: true, status: true },
      }),
    ]);
    const roles = rolesResponse.status === "OK" ? rolesResponse.roles : [];
    return {
      ...this.toManagedUser(user, roles),
      loginMethods: [...new Set((authUser?.loginMethods ?? []).map((method) =>
        method.recipeId === "thirdparty" ? method.thirdParty?.id ?? "thirdparty" : method.recipeId,
      ))],
      lastOrder,
    };
  }

  async listRoles() {
    await this.ensureStaffRoles();
    return STAFF_ROLE_DEFINITIONS;
  }

  async setRole(supertokensId: string, role: StaffRole | null, actorId: string) {
    if (supertokensId === actorId) throw new ConflictError("No podés cambiar tu propio rol");
    if (role !== null && !STAFF_ROLES.includes(role)) throw new ValidationError("Rol de staff inválido");
    const user = await prisma.user.findUnique({ where: { supertokensId } });
    if (!user) throw new NotFoundError("User not found");
    await this.ensureStaffRoles();

    const current = await UserRoles.getRolesForUser(TENANT_ID, supertokensId);
    const existingRoles = current.status === "OK" ? current.roles : [];
    if (current.status !== "OK") {
      throw new ConflictError("No se pudieron consultar los roles de la cuenta");
    }
    if (role !== "ADMIN" && existingRoles.includes("ADMIN")) {
      const admins = await UserRoles.getUsersThatHaveRole(TENANT_ID, "ADMIN");
      if (admins.status !== "OK") {
        throw new ConflictError("No se pudo verificar que exista otro administrador");
      }
      if (admins.users.length <= 1) {
        throw new ConflictError("No se puede quitar el acceso al último administrador");
      }
    }

    await this.replaceStaffRoles(supertokensId, role, existingRoles);
    await Session.revokeAllSessionsForUser(supertokensId, true, TENANT_ID);
    return this.detail(supertokensId);
  }

  async revokeSessions(supertokensId: string) {
    const user = await prisma.user.findUnique({ where: { supertokensId }, select: { id: true } });
    if (!user) throw new NotFoundError("User not found");
    const revoked = await Session.revokeAllSessionsForUser(supertokensId, true, TENANT_ID);
    return { revoked: revoked.length };
  }

  async invite(input: { email?: unknown; name?: unknown; role?: unknown }) {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new ValidationError("Ingresá un email válido");
    const name =
      input.name === undefined || input.name === null || input.name === ""
        ? null
        : typeof input.name === "string" && input.name.trim().length <= 120
          ? input.name.trim()
          : (() => {
              throw new ValidationError("name debe ser texto de hasta 120 caracteres");
            })();
    const role = input.role;
    if (typeof role !== "string" || !STAFF_ROLES.includes(role as StaffRole)) {
      throw new ValidationError("role debe ser ADMIN, EDITOR o EMPLOYEE");
    }
    await this.ensureStaffRoles();

    let authUser = (await supertokens.listUsersByAccountInfo(TENANT_ID, { email }))[0];
    let created = false;
    if (!authUser) {
      const temporaryPassword = `${crypto.randomBytes(32).toString("hex")}Aa1!`;
      const result = await EmailPassword.signUp(TENANT_ID, email, temporaryPassword);
      if (result.status === "OK") {
        const newAuthUser = await supertokens.getUser(result.user.id);
        if (!newAuthUser) throw new NotFoundError("No se encontró la cuenta creada en SuperTokens");
        authUser = newAuthUser;
        created = true;
      } else if (result.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        authUser = (await supertokens.listUsersByAccountInfo(TENANT_ID, { email }))[0];
      } else {
        throw new ConflictError("No se pudo crear la cuenta de invitación");
      }
    }
    if (!authUser) throw new NotFoundError("No se encontró la cuenta creada en SuperTokens");

    const userId = authUser.id;
    const actualEmail = authUser.emails[0] ?? email;
    await prisma.user.upsert({
      where: { supertokensId: userId },
      create: { supertokensId: userId, email: actualEmail, name },
      update: { email: actualEmail, ...(name ? { name } : {}) },
    });
    await this.assignRole(userId, role as StaffRole);

    let emailSent = false;
    let inviteLink: string | null = null;
    let verificationEmailSent = false;
    let verificationLink: string | null = null;
    if (created) {
      try {
        const result = await EmailPassword.sendResetPasswordEmail(TENANT_ID, userId, actualEmail);
        emailSent = result.status === "OK";
      } catch {
        emailSent = false;
      }
      if (!emailSent) {
        const link = await EmailPassword.createResetPasswordLink(TENANT_ID, userId, actualEmail);
        if (link.status !== "OK") throw new NotFoundError("No se pudo crear el enlace de invitación");
        inviteLink = link.link;
      }
    }

    const passwordLoginMethod = authUser.loginMethods.find(
      (method) => method.recipeId === "emailpassword" && method.email?.toLowerCase() === actualEmail.toLowerCase(),
    );
    if (passwordLoginMethod && !passwordLoginMethod.verified) {
      try {
        const result = await EmailVerification.sendEmailVerificationEmail(
          TENANT_ID,
          userId,
          passwordLoginMethod.recipeUserId,
          actualEmail,
        );
        verificationEmailSent = result.status === "OK";
      } catch {
        verificationEmailSent = false;
      }
      if (!verificationEmailSent) {
        const link = await EmailVerification.createEmailVerificationLink(
          TENANT_ID,
          passwordLoginMethod.recipeUserId,
          actualEmail,
        );
        if (link.status !== "OK") {
          throw new ConflictError("No se pudo crear el enlace para verificar el email");
        }
        verificationLink = link.link;
      }
    }

    return {
      user: await this.detail(userId),
      created,
      emailSent,
      inviteLink,
      verificationEmailSent,
      verificationLink,
    };
  }

  private toManagedUser(user: any, roles: string[]) {
    return {
      id: user.id,
      supertokensId: user.supertokensId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      ordersCount: user._count?.orders ?? 0,
      role: primaryStaffRole(roles),
      roles,
      permissions: permissionsForRoles(roles),
    };
  }

  private async ensureStaffRoles() {
    for (const role of STAFF_ROLE_DEFINITIONS) {
      const result = await UserRoles.createNewRoleOrAddPermissions(role.key, role.permissions);
      if (result.status !== "OK") throw new ConflictError(`No se pudo preparar el rol ${role.key}`);
    }
  }

  private async assignRole(userId: string, role: StaffRole) {
    const current = await UserRoles.getRolesForUser(TENANT_ID, userId);
    if (current.status !== "OK") throw new ConflictError("No se pudieron consultar los roles de la cuenta");
    await this.replaceStaffRoles(userId, role, current.roles);
  }

  private async replaceStaffRoles(
    userId: string,
    role: StaffRole | null,
    currentRoles: string[],
  ) {
    const staffRoles = currentRoles.filter((item) => STAFF_ROLES.includes(item as StaffRole));
    const removedRoles: string[] = [];
    let targetRoleAdded = false;

    try {
      for (const existingRole of staffRoles) {
        if (existingRole === role) continue;
        const result = await UserRoles.removeUserRole(TENANT_ID, userId, existingRole);
        if (result.status !== "OK") {
          throw new ConflictError(`No se pudo quitar el rol ${existingRole}`);
        }
        removedRoles.push(existingRole);
      }
      if (role && !staffRoles.includes(role)) {
        const result = await UserRoles.addRoleToUser(TENANT_ID, userId, role);
        if (result.status !== "OK") {
          throw new ConflictError(`No se pudo asignar el rol ${role}`);
        }
        targetRoleAdded = true;
      }
      await prisma.user.update({
        where: { supertokensId: userId },
        data: { role: role ?? "CONSUMER" },
      });
    } catch (error) {
      let rollbackFailed = false;
      if (targetRoleAdded && role) {
        const result = await UserRoles.removeUserRole(TENANT_ID, userId, role);
        rollbackFailed ||= result.status !== "OK";
      }
      for (const removedRole of removedRoles) {
        const result = await UserRoles.addRoleToUser(TENANT_ID, userId, removedRole);
        rollbackFailed ||= result.status !== "OK";
      }
      if (rollbackFailed) {
        throw new ConflictError(
          "Falló el cambio de rol y no se pudo restaurar por completo el acceso anterior",
        );
      }
      throw error;
    }
  }
}
