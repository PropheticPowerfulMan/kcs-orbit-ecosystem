import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { signToken } from "../utils/jwt";

export async function register(req: Request, res: Response) {
  const { fullName, email, password, role, organizationId } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ message: "fullName, email, password and role are required" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: "Email already exists" });

  const passwordHash = await bcrypt.hash(password, 10);

  let resolvedOrganizationId: string | null = organizationId ?? null;

  if (!resolvedOrganizationId) {
    const defaultOrganization = await prisma.organization.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });
    resolvedOrganizationId = defaultOrganization?.id ?? null;
  }

  const user = await prisma.user.create({
    data: { fullName, email, passwordHash, role, organizationId: resolvedOrganizationId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      organizationId: true,
      createdAt: true
    }
  });

  const token = signToken({ userId: user.id, role: user.role, organizationId: user.organizationId });
  return res.status(201).json({ user, token });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  const token = signToken({ userId: user.id, role: user.role, organizationId: user.organizationId });

  return res.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    },
    token
  });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      organizationId: true,
      organization: {
        select: { id: true, name: true, slug: true, isActive: true }
      },
      createdAt: true
    }
  });

  return res.json({ user });
}
