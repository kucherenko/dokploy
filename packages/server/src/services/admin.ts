import { randomBytes } from "node:crypto";
import { db } from "@dokploy/server/db";
import {
	account,
	admins,
	type apiCreateUserInvitation,
	auth,
	member,
	organization,
	users_temp,
} from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { IS_CLOUD } from "../constants";

export type Admin = typeof users_temp.$inferSelect;
export const createInvitation = async (
	input: typeof apiCreateUserInvitation._type,
	adminId: string,
) => {
	await db.transaction(async (tx) => {
		const result = await tx
			.insert(auth)
			.values({
				email: input.email.toLowerCase(),
				rol: "user",
				password: bcrypt.hashSync("01231203012312", 10),
			})
			.returning()
			.then((res) => res[0]);

		if (!result) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the user",
			});
		}
		const expiresIn24Hours = new Date();
		expiresIn24Hours.setDate(expiresIn24Hours.getDate() + 1);
		const token = randomBytes(32).toString("hex");
		// await tx
		// 	.insert(users)
		// 	.values({
		// 		adminId: adminId,
		// 		authId: result.id,
		// 		token,
		// 		expirationDate: expiresIn24Hours.toISOString(),
		// 	})
		// 	.returning();
	});
};

export const findUserById = async (userId: string) => {
	const user = await db.query.users_temp.findFirst({
		where: eq(users_temp.id, userId),
		// with: {
		// 	account: true,
		// },
	});
	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found",
		});
	}
	return user;
};

export const updateUser = async (userId: string, userData: Partial<Admin>) => {
	const user = await db
		.update(users_temp)
		.set({
			...userData,
		})
		.where(eq(users_temp.id, userId))
		.returning()
		.then((res) => res[0]);

	return user;
};

export const updateAdminById = async (
	adminId: string,
	adminData: Partial<Admin>,
) => {
	// const admin = await db
	// 	.update(admins)
	// 	.set({
	// 		...adminData,
	// 	})
	// 	.where(eq(admins.adminId, adminId))
	// 	.returning()
	// 	.then((res) => res[0]);
	// return admin;
};

export const findAdminById = async (userId: string) => {
	const admin = await db.query.admins.findFirst({
		// where: eq(admins.userId, userId),
	});
	return admin;
};

export const isAdminPresent = async () => {
	const admin = await db.query.member.findFirst({
		where: eq(member.role, "owner"),
	});

	console.log("admin", admin);

	if (!admin) {
		return false;
	}
	return true;
};

export const findAdminByAuthId = async (authId: string) => {
	const admin = await db.query.admins.findFirst({
		where: eq(admins.authId, authId),
		with: {
			users: true,
		},
	});
	if (!admin) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Admin not found",
		});
	}
	return admin;
};

export const findAdmin = async () => {
	const admin = await db.query.admins.findFirst({});
	if (!admin) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Admin not found",
		});
	}
	return admin;
};

export const getUserByToken = async (token: string) => {
	const user = await db.query.users.findFirst({
		where: eq(users.token, token),
		with: {
			auth: {
				columns: {
					password: false,
				},
			},
		},
	});

	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Invitation not found",
		});
	}
	return {
		...user,
		isExpired: user.isRegistered,
	};
};

export const removeUserById = async (userId: string) => {
	await db
		.delete(users_temp)
		.where(eq(users_temp.id, userId))
		.returning()
		.then((res) => res[0]);
};

export const removeAdminByAuthId = async (authId: string) => {
	const admin = await findAdminByAuthId(authId);
	if (!admin) return null;

	// First delete all associated users
	const users = admin.users;

	for (const user of users) {
		await removeUserById(user.id);
	}
	// Then delete the auth record which will cascade delete the admin
	return await db
		.delete(auth)
		.where(eq(auth.id, authId))
		.returning()
		.then((res) => res[0]);
};

export const getDokployUrl = async () => {
	if (IS_CLOUD) {
		return "https://app.dokploy.com";
	}
	const admin = await findAdmin();

	if (admin.host) {
		return `https://${admin.host}`;
	}
	return `http://${admin.serverIp}:${process.env.PORT}`;
};
