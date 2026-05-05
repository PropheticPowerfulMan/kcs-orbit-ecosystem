import { Request, Response } from "express";
import { prisma } from "../db";
import { eventBus } from "../events/eventBus";
import { loadSharedDirectory } from "../services/shared-directory.service";

const PRIVILEGED_DIRECTORY_ROLES = ["ADMIN", "STAFF", "TEACHER"];
const PRIVILEGED_FINANCIAL_ROLES = ["ADMIN", "STAFF"];

function getOrganizationId(req: Request) {
  return req.user?.organizationId ?? undefined;
}

function organizationWhere(req: Request) {
  const organizationId = getOrganizationId(req);
  return organizationId ? { organizationId } : {};
}

function hasAnyRole(req: Request, ...roles: string[]) {
  return !!req.user && roles.includes(req.user.role);
}

export async function listUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany({
    where: organizationWhere(req),
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      organizationId: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(users);
}

export async function createStudent(req: Request, res: Response) {
  const { firstName, lastName, gender, classId, parentId } = req.body;
  const student = await prisma.student.create({
    data: {
      firstName,
      lastName,
      gender,
      classId,
      parentId,
      organizationId: getOrganizationId(req)
    }
  });
  res.status(201).json(student);
}

export async function listStudents(req: Request, res: Response) {
  if (!hasAnyRole(req, ...PRIVILEGED_DIRECTORY_ROLES)) {
    const directory = await loadSharedDirectory(getOrganizationId(req));
    return res.json({ visibility: directory.visibility, students: directory.students });
  }

  const students = await prisma.student.findMany({
    where: organizationWhere(req),
    include: { class: true, parent: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(students);
}

export async function createParent(req: Request, res: Response) {
  const { fullName, phone, email } = req.body;
  const parent = await prisma.parent.create({
    data: { fullName, phone, email, organizationId: getOrganizationId(req) }
  });
  res.status(201).json(parent);
}

export async function listParents(req: Request, res: Response) {
  if (!hasAnyRole(req, ...PRIVILEGED_DIRECTORY_ROLES)) {
    const directory = await loadSharedDirectory(getOrganizationId(req));
    return res.json({ visibility: directory.visibility, parents: directory.parents });
  }

  const parents = await prisma.parent.findMany({
    where: organizationWhere(req),
    include: { students: true }
  });
  res.json(parents);
}

export async function createTeacher(req: Request, res: Response) {
  const { fullName, phone, email, subject } = req.body;
  const teacher = await prisma.teacher.create({
    data: { fullName, phone, email, subject, organizationId: getOrganizationId(req) }
  });
  res.status(201).json(teacher);
}

export async function listTeachers(req: Request, res: Response) {
  if (!hasAnyRole(req, ...PRIVILEGED_DIRECTORY_ROLES)) {
    const directory = await loadSharedDirectory(getOrganizationId(req));
    return res.json({ visibility: directory.visibility, teachers: directory.teachers });
  }

  const teachers = await prisma.teacher.findMany({ where: organizationWhere(req) });
  res.json(teachers);
}

export async function createClass(req: Request, res: Response) {
  const { name, gradeLevel, teacherId } = req.body;
  const klass = await prisma.class.create({
    data: { name, gradeLevel, teacherId, organizationId: getOrganizationId(req) }
  });
  res.status(201).json(klass);
}

export async function listClasses(req: Request, res: Response) {
  const classes = await prisma.class.findMany({
    where: organizationWhere(req),
    include: { teacher: true, students: true }
  });
  res.json(classes);
}

export async function createPayment(req: Request, res: Response) {
  const { studentId, amount, motif, method, reference } = req.body;
  const payment = await prisma.payment.create({
    data: {
      studentId,
      amount: Number(amount),
      motif,
      method,
      reference,
      organizationId: getOrganizationId(req)
    }
  });
  eventBus.emit("payment.created", payment);
  res.status(201).json(payment);
}

export async function listPayments(req: Request, res: Response) {
  if (!hasAnyRole(req, ...PRIVILEGED_FINANCIAL_ROLES)) {
    return res.status(403).json({
      message: "Forbidden: payments are restricted to privileged roles"
    });
  }

  const payments = await prisma.payment.findMany({
    where: organizationWhere(req),
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(payments);
}

export async function createGrade(req: Request, res: Response) {
  const { studentId, subject, score, maxScore, term } = req.body;
  const grade = await prisma.grade.create({
    data: {
      studentId,
      subject,
      score: Number(score),
      maxScore: Number(maxScore),
      term,
      organizationId: getOrganizationId(req)
    }
  });
  eventBus.emit("grade.created", grade);
  res.status(201).json(grade);
}

export async function listGrades(req: Request, res: Response) {
  if (!hasAnyRole(req, ...PRIVILEGED_DIRECTORY_ROLES)) {
    return res.status(403).json({
      message: "Forbidden: grades are restricted to privileged roles"
    });
  }

  const grades = await prisma.grade.findMany({
    where: organizationWhere(req),
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(grades);
}

export async function createAttendance(req: Request, res: Response) {
  const { studentId, date, status } = req.body;
  const attendance = await prisma.attendance.create({
    data: {
      studentId,
      date: new Date(date),
      status,
      organizationId: getOrganizationId(req)
    }
  });
  res.status(201).json(attendance);
}

export async function listAttendance(req: Request, res: Response) {
  if (!hasAnyRole(req, ...PRIVILEGED_DIRECTORY_ROLES)) {
    return res.status(403).json({
      message: "Forbidden: attendance is restricted to privileged roles"
    });
  }

  const attendance = await prisma.attendance.findMany({
    where: organizationWhere(req),
    include: { student: true },
    orderBy: { date: "desc" }
  });
  res.json(attendance);
}

export async function createAnnouncement(req: Request, res: Response) {
  const { title, message, audience } = req.body;
  const announcement = await prisma.announcement.create({
    data: { title, message, audience, organizationId: getOrganizationId(req) }
  });
  res.status(201).json(announcement);
}

export async function listAnnouncements(req: Request, res: Response) {
  const audienceFilter = hasAnyRole(req, ...PRIVILEGED_DIRECTORY_ROLES)
    ? organizationWhere(req)
    : {
        ...organizationWhere(req),
        OR: [
          { audience: req.user?.role || "" },
          { audience: "ALL" }
        ]
      };

  const announcements = await prisma.announcement.findMany({
    where: audienceFilter,
    orderBy: { createdAt: "desc" }
  });
  res.json(announcements);
}

export async function listSharedDirectory(req: Request, res: Response) {
  const directory = await loadSharedDirectory(getOrganizationId(req));
  res.json(directory);
}
