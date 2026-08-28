import { api } from "../services/api";

const warmupTasks = new Map<string, Promise<void>>();

function rememberWarmup(key: string, loader: () => Promise<void>) {
  const existing = warmupTasks.get(key);
  if (existing) return existing;

  const task = loader().catch(() => undefined);
  warmupTasks.set(key, task);
  return task;
}

const staffRouteLoaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("../pages/FinanceDashboardPage"),
  "/operations": () => import("../pages/FinancialOperationsPage"),
  "/reports": () => import("../pages/ReportsPage"),
  "/payments": () => import("../pages/PaymentsPage"),
  "/bank-transfers": () => import("../pages/BankTransferVerificationPage"),
  "/messages": () => import("../pages/MessagesPage"),
  "/parent-payments": () => import("../pages/FinanceParentAdminPage"),
  "/students": () => import("../pages/StudentsDirectoryPage"),
  "/employees": () => import("../pages/EmployeesPage"),
  "/parents": () => import("../pages/ParentsManagementPage"),
  "/ai": () => import("../pages/AIAssistantPage")
};

export function warmStaffRoute(path: string) {
  const loader = staffRouteLoaders[path];
  return loader ? rememberWarmup(path, async () => { await loader(); }) : Promise.resolve();
}

export async function warmAllStaffRoutes() {
  await Promise.allSettled([
    ...Object.keys(staffRouteLoaders).map(warmStaffRoute),
    api("/api/shared-directory"),
    api("/api/parents"),
    api("/api/classes"),
    api("/api/bank-transfer-requests")
  ]);
}
