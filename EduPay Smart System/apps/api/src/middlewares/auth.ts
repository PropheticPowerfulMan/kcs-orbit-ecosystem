import { NextFunction, Request, Response } from "express";
import {createAccessVerifier} from "../ecosystemAccessVerifier";
import {prisma} from "../prisma";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const verifyInstitutionalAccess=createAccessVerifier({url:process.env.KCS_ORBIT_API_URL||"",key:process.env.KCS_ORBIT_API_KEY||"",organization:process.env.KCS_ORBIT_ORGANIZATION_ID||"",app:"EDUPAY"});
export type JwtPayload = {
  sub: string;
  role: "SUPER_ADMIN" | "OWNER" | "ADMIN" | "FINANCIAL_MANAGER" | "ACCOUNTANT" | "CASHIER" | "HR_MANAGER" | "AUDITOR" | "PARENT" | "EMPLOYEE";
  schoolId: string;
};

export type AuthenticatedRequest = Request & { user?: JwtPayload };

export async function authGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "Non authentifie" });
  }

  const token = header.replace("Bearer ", "").trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const account=await prisma.user.findUnique({where:{id:payload.sub},select:{email:true,accessCode:true}});
    await verifyInstitutionalAccess([payload.sub,account?.email,account?.accessCode]);
    req.user = payload;
    return next();
  } catch(error:any) {
    if(error?.status===403||error?.status===503)return res.status(error.status).json({message:error.message});
    return res.status(401).json({ message: "Token invalide" });
  }
}

export function authorize(...roles: Array<JwtPayload["role"]>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Non authentifie" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Acces refuse" });
    }
    return next();
  };
}
