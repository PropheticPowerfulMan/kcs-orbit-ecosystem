import { api } from "../services/api";

const warmupTasks = new Map<string, Promise<void>>();

function rememberWarmup(key: string, loader: () => Promise<void>) {
  const existing = warmupTasks.get(key);
  if (existing) return existing;

  const task = loader().catch(() => { warmupTasks.delete(key); });
  warmupTasks.set(key, task);
  return task;
}

const staffRouteLoaders: Partial<Record<string, () => Promise<unknown>>> = {
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
  if(loader) void rememberWarmup("data:"+path,()=>warmRouteData(path));
  return loader ? rememberWarmup(path, async () => { await loader(); }) : Promise.resolve();
}

// Warm one route on intent. Background warming is sequential and stops on constrained networks.
export async function warmAllStaffRoutes() {
 const connection=(navigator as Navigator & {connection?:{saveData?:boolean;effectiveType?:string}}).connection;
 if(connection?.saveData||/2g/.test(connection?.effectiveType||""))return;
 for(const path of ["/payments","/parent-payments","/messages"]){
  await new Promise<void>(resolve=>setTimeout(resolve,250));
  await warmStaffRoute(path);
 }
}
export async function warmRouteData(path:string){
 if(path!=="/parent-payments")return;
 const token=localStorage.getItem("edupay_token");
 const rows=await api<Array<{id:string}>>("/api/parents");
 if(token!==localStorage.getItem("edupay_token"))return;
 await Promise.allSettled([api("/api/finance/catalog"),...(rows[0]?[api("/api/finance/parents/"+rows[0].id+"/profile")]:[])]);
}
