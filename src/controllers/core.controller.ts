import { Request, Response } from "express";
import { prisma } from "../db";
import { eventBus } from "../events/eventBus";

export async function listUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(users);
}

export async function createStudent(req: Request, res: Response) {
  const { firstName, lastName, gender, classId, parentId } = req.body;
  const student = await prisma.student.create({
    data: { firstName, lastName, gender, classId, parentId }
  });
  res.status(201).json(student);
}

export async function listStudents(req: Request, res: Response) {
  const students = await prisma.student.findMany({
    include: { class: true, parent: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(students);
}

export async function createParent(req: Request, res: Response) {
  const { fullName, phone, email } = req.body;
  const parent = await prisma.parent.create({ data: { fullName, phone, email } });
  res.status(201).json(parent);
}

export async function listParents(req: Request, res: Response) {
  const parents = await prisma.parent.findMany({ include: { students: true } });
  res.json(parents);
}

export async function createTeacher(req: Request, res: Response) {
  const { fullName, phone, email, subject } = req.body;
  const teacher = await prisma.teacher.create({ data: { fullName, phone, email, subject } });
  res.status(201).json(teacher);
}

export async function listTeachers(req: Request, res: Response) {
  const teachers = await prisma.teacher.findMany();
  res.json(teachers);
}

export async function createClass(req: Request, res: Response) {
  const { name, gradeLevel, teacherId } = req.body;
  const klass = await prisma.class.create({ data: { name, gradeLevel, teacherId } });
  res.status(201).json(klass);
}

export async function listClasses(req: Request, res: Response) {
  const classes = await prisma.class.findMany({ include: { teacher: true, students: true } });
  res.json(classes);
}

export async function createPayment(req: Request, res: Response) {
  const { studentId, amount, motif, method, reference } = req.body;
  const payment = await prisma.payment.create({
    data: { studentId, amount: Number(amount), motif, method, reference }
  });
  eventBus.emit("payment.created", payment);
  res.status(201).json(payment);
}

export async function listPayments(req: Request, res: Response) {
  const payments = await prisma.payment.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(payments);
}

export async function createGrade(req: Request, res: Response) {
  const { studentId, subject, score, maxScore, term } = req.body;
  const grade = await prisma.grade.create({
    data: { studentId, subject, score: Number(score), maxScore: Number(maxScore), term }
  });
  eventBus.emit("grade.created", grade);
  res.status(201).json(grade);
}

export async function listGrades(req: Request, res: Response) {
  const grades = await prisma.grade.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(grades);
}

export async function createAttendance(req: Request, res: Response) {
  const { studentId, date, status } = req.body;
  const attendance = await prisma.attendance.create({
    data: { studentId, date: new Date(date), status }
  });
  res.status(201).json(attendance);
}

export async function listAttendance(req: Request, res: Response) {
  const attendance = await prisma.attendance.findMany({
    include: { student: true },
    orderBy: { date: "desc" }
  });
  res.json(attendance);
}

export async function createAnnouncement(req: Request, res: Response) {
  const { title, message, audience } = req.body;
  const announcement = await prisma.announcement.create({
    data: { title, message, audience }
  });
  res.status(201).json(announcement);
}

export async function listAnnouncements(req: Request, res: Response) {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.json(announcements);
}
