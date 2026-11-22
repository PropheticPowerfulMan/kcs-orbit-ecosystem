import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  BadgeDollarSign,
  Bot,
  BriefcaseBusiness,
  ChartColumnBig,
  CreditCard,
  HandCoins,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  UserRoundSearch,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { schoolBranding } from "../config/branding";
import { useI18n } from "../i18n";
import { useAuthStore } from "../store/auth";
import { useUiStore } from "../store/ui";
import { warmStaffRoute } from "../utils/staffRouteWarmup";

type SidebarLink = {
  to: string;
  label: string;
  icon: ReactNode;
};

export function Sidebar() {
  const { t, lang } = useI18n();
  const L = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const role = useAuthStore((state) => state.role);
  const isDesktopSidebarOpen = useUiStore(
    (state) => state.isDesktopSidebarOpen,
  );
  const isMobileNavOpen = useUiStore((state) => state.isMobileNavOpen);
  const setDesktopSidebarOpen = useUiStore(
    (state) => state.setDesktopSidebarOpen,
  );
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  const links: SidebarLink[] =
    role === "PARENT"
      ? [
          {
            to: "/parent",
            label: t("navParent"),
            icon: <BadgeDollarSign className="h-4 w-4" aria-hidden="true" />,
          },
          {
            to: "/parent/bank-transfers",
            label: L("Envoyer une preuve bancaire", "Submit bank proof"),
            icon: <Landmark className="h-4 w-4" aria-hidden="true" />,
          },
        ]
      : role === "EMPLOYEE"
        ? [
            {
              to: "/employee",
              label: L("Ma situation", "My account"),
              icon: <HandCoins className="h-4 w-4" aria-hidden="true" />,
            },
          ]
        : [
            {
              to: "/",
              label: t("navDashboard"),
              icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/operations",
              label: t("navOperations"),
              icon: <Landmark className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/reports",
              label: t("navReports"),
              icon: <ChartColumnBig className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/payments",
              label: t("navPayments"),
              icon: <CreditCard className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/bank-transfers",
              label: L(
                "Virements bancaires à vérifier",
                "Bank transfers to review",
              ),
              icon: <Landmark className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/messages",
              label: t("navMessages"),
              icon: (
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              ),
            },
            {
              to: "/parent-payments",
              label: t("navParentPayments"),
              icon: <UserRoundSearch className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/students",
              label: t("navStudents"),
              icon: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/employees",
              label: t("navEmployees"),
              icon: (
                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
              ),
            },
            {
              to: "/parents",
              label: t("navParents"),
              icon: <Users className="h-4 w-4" aria-hidden="true" />,
            },
            {
              to: "/ai",
              label: t("navAI"),
              icon: <Bot className="h-4 w-4" aria-hidden="true" />,
            },
          ];

  const [query, setQuery] = useState("");
  const sheet = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia("(max-width:1023px)");
    const sync = () => {
      if (isMobileNavOpen && media.matches && !sheet.current?.open)
        sheet.current?.showModal();
      else if ((!isMobileNavOpen || !media.matches) && sheet.current?.open)
        sheet.current?.close();
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [isMobileNavOpen]);
  const visible = links.filter((l) =>
    l.label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(
        query
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      ),
  );
  const renderLink = (link: SidebarLink, compact = false) => (
    <NavLink data-kcs-no-processing="true"
      key={link.to}
      to={link.to}
      end
      title={link.label}
      onMouseEnter={() => void warmStaffRoute(link.to)}
      onFocus={() => void warmStaffRoute(link.to)}
      onClick={() => setMobileNavOpen(false)}
      className={({ isActive }) =>
        "ep-nav-item" +
        (isActive ? " ep-active" : "") +
        (compact ? " ep-compact" : "")
      }
    >
      {link.icon}
      <span>{link.label}</span>
      <ChevronRight className="ep-nav-chevron" size={13} />
    </NavLink>
  );
  return (
    <>
      <aside
        className={"ep-sidebar" + (!isDesktopSidebarOpen ? " ep-rail" : "")}
      >
        <div className="ep-side-brand">
          <img src={schoolBranding.logoSrc} alt="KCS" />
          <div>
            <b>EduPay</b>
            <small>KCS ORBIT ECOSYSTEM</small>
          </div>
        </div>
        {isDesktopSidebarOpen && (
          <>
            <div className="ep-workspace-tag">
              <span />
              {role === "PARENT"
                ? L("Espace famille", "Family workspace")
                : role === "EMPLOYEE"
                  ? L("Espace personnel", "Personal workspace")
                  : L("Direction financière", "Finance workspace")}
            </div>
            <label className="ep-nav-search">
              <Search size={15} />
              <input
                aria-label={L("Rechercher un module", "Search modules")}
                placeholder={L("Trouver un module…", "Find a module…")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </>
        )}
        <nav aria-label={L("Navigation financière", "Financial navigation")}>
          {visible.map((link) => renderLink(link, !isDesktopSidebarOpen))}
          {!visible.length && (
            <p className="ep-nav-empty">
              {L("Aucun module trouvé.", "No matching modules.")}
            </p>
          )}
        </nav>
        <div className="ep-sidebar-foot">
          {isDesktopSidebarOpen && (
            <a
              href={
                import.meta.env.VITE_NEXUS_URL ||
                "https://kinshasachristianschool.org"
              }
            >
              <ArrowLeft size={15} />
              {L("Retour à Nexus AI", "Back to Nexus AI")}
            </a>
          )}
          <button data-kcs-no-processing="true"
            onClick={() => setDesktopSidebarOpen(!isDesktopSidebarOpen)}
            aria-label={
              isDesktopSidebarOpen
                ? L("Réduire le menu", "Collapse navigation")
                : L("Agrandir le menu", "Expand navigation")
            }
          >
            {isDesktopSidebarOpen ? (
              <PanelLeftClose size={17} />
            ) : (
              <PanelLeftOpen size={17} />
            )}
            <span>{isDesktopSidebarOpen ? L("Réduire", "Collapse") : ""}</span>
          </button>
        </div>
      </aside>
      <nav
        className="ep-mobile-dock"
        aria-label={L("Raccourcis de navigation", "Navigation shortcuts")}
      >
        {links.slice(0, 3).map((link) => renderLink(link, true))}
        <button data-kcs-no-processing="true"
          className="ep-dock-menu"
          onClick={() => setMobileNavOpen(true)}
          aria-label={L("Tous les modules", "All modules")}
        >
          <Menu size={19} />
          <span>{L("Menu", "Menu")}</span>
        </button>
      </nav>
      <dialog
        ref={sheet}
        className="ep-mobile-sheet"
        onClose={() => setMobileNavOpen(false)}
        onClick={(e) => {
          if (e.target === sheet.current) setMobileNavOpen(false);
        }}
      >
        <div className="ep-sheet-heading">
          <span>
            <b>EduPay</b>
            <small>
              {L("Votre espace financier", "Your finance workspace")}
            </small>
          </span>
          <button data-kcs-no-processing="true"
            className="ep-sheet-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label={L("Fermer", "Close")}
          >
            <X size={21} />
          </button>
        </div>
        <label className="ep-nav-search">
          <Search size={16} />
          <input
            placeholder={L("Trouver un module…", "Find a module…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <nav>{visible.map((link) => renderLink(link))}</nav>
        <a
          className="ep-sheet-nexus"
          href={
            import.meta.env.VITE_NEXUS_URL ||
            "https://kinshasachristianschool.org"
          }
        >
          <ArrowLeft size={16} />
          {L("Retour à Nexus AI", "Back to Nexus AI")}
        </a>
      </dialog>
    </>
  );
}
