import React, { useState } from "react";
import { Menu, Maximize, Bell, User, TreeDeciduous } from "lucide-react";

/**
 * GSFC Clubs & Projects — Site Header
 * -----------------------------------
 * Self-contained header component:
 *  - Left: collapsible sidebar rail with GSFC-style logo (full logo when open,
 *    icon-only badge when collapsed)
 *  - Top: light cyan → lavender gradient bar with hamburger toggle, fullscreen
 *    icon, page title, notification bell and account icon
 *  - Center: intentionally blank canvas (header-only deliverable)
 *
 * Usage: <Header /> — drop into any page; it renders its own sidebar + topbar
 * shell and leaves a blank content area below/right for future pages.
 */

const SIDEBAR_OPEN_WIDTH = 220;
const SIDEBAR_CLOSED_WIDTH = 76;

function Logo({ collapsed }) {
  return (
    <div style={styles.logoWrap}>
      <div style={styles.logoBadge}>
        <TreeDeciduous size={collapsed ? 26 : 30} color="#2f6f4f" strokeWidth={1.75} />
      </div>
      {!collapsed && (
        <div style={styles.logoText}>
          <span style={styles.logoTitleLine}>
            <span style={styles.logoTitleAccent}>GSFC</span>
          </span>
          <span style={styles.logoTitleMain}>UNIVERSITY</span>
          <span style={styles.logoSubtitle}>CLUBS &amp; PROJECTS</span>
        </div>
      )}
    </div>
  );
}

export default function Header({ pageTitle = "Clubs & Projects" }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={styles.shell}>
      {/* ---------------- Sidebar ---------------- */}
      <aside
        style={{
          ...styles.sidebar,
          width: sidebarOpen ? SIDEBAR_OPEN_WIDTH : SIDEBAR_CLOSED_WIDTH,
        }}
      >
        <Logo collapsed={!sidebarOpen} />
        {/* Sidebar nav intentionally left empty per current scope */}
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div style={styles.mainColumn}>
        {/* ---------------- Top gradient header ---------------- */}
        <header style={styles.topbar}>
          <div style={styles.topbarLeft}>
            <button
              type="button"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setSidebarOpen((v) => !v)}
              style={styles.iconButton}
            >
              <Menu size={22} color="#3b3b55" />
            </button>
            <button
              type="button"
              aria-label="Toggle fullscreen"
              style={styles.iconButton}
            >
              <Maximize size={20} color="#3b3b55" />
            </button>
            <h1 style={styles.pageTitle}>{pageTitle}</h1>
          </div>

          <div style={styles.topbarRight}>
            <button type="button" aria-label="Notifications" style={styles.iconButtonRight}>
              <Bell size={20} color="#3b3b55" />
              <span style={styles.badge}>0</span>
            </button>
            <button type="button" aria-label="Account" style={styles.iconButtonRight}>
              <User size={20} color="#3b3b55" />
            </button>
          </div>
        </header>

        {/* ---------------- Blank content canvas ---------------- */}
        <main style={styles.content} />
      </div>
    </div>
  );
}

const GRADIENT = "linear-gradient(100deg, #c9c3f5 0%, #b7d4f2 45%, #9fe0f0 100%)";

const styles = {
  shell: {
    display: "flex",
    width: "100%",
    height: "100vh",
    fontFamily:
      "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    background: "#f4f6fb",
  },

  /* Sidebar */
  sidebar: {
    flexShrink: 0,
    background: "#ffffff",
    borderRight: "1px solid #eceef4",
    transition: "width 220ms ease",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    paddingTop: "18px",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 16px",
    height: "72px",
  },
  logoBadge: {
    width: "46px",
    height: "46px",
    minWidth: "46px",
    borderRadius: "50%",
    background: "linear-gradient(180deg, #ffe9b8 0%, #ffcf6b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  },
  logoText: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.05,
    whiteSpace: "nowrap",
  },
  logoTitleLine: { fontSize: "11px" },
  logoTitleAccent: {
    color: "#f5a623",
    fontWeight: 700,
    letterSpacing: "0.5px",
  },
  logoTitleMain: {
    fontSize: "17px",
    fontWeight: 800,
    color: "#1e3a5f",
    letterSpacing: "0.3px",
  },
  logoSubtitle: {
    fontSize: "9px",
    fontWeight: 600,
    color: "#8a92a6",
    letterSpacing: "0.6px",
    marginTop: "2px",
  },

  /* Main column */
  mainColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },

  /* Topbar */
  topbar: {
    height: "72px",
    minHeight: "72px",
    background: GRADIENT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    borderBottom: "1px solid rgba(255,255,255,0.4)",
  },
  topbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },
  iconButton: {
    background: "rgba(255,255,255,0.35)",
    border: "none",
    borderRadius: "8px",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background 150ms ease",
  },
  iconButtonRight: {
    position: "relative",
    background: "transparent",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: "6px",
  },
  badge: {
    position: "absolute",
    top: "-2px",
    right: "-2px",
    background: "#ff5a5f",
    color: "#fff",
    fontSize: "9px",
    fontWeight: 700,
    borderRadius: "999px",
    width: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    color: "#33355a",
    fontSize: "22px",
    fontWeight: 600,
    margin: 0,
  },

  /* Blank content */
  content: {
    flex: 1,
    background: "#ffffff",
  },
};
