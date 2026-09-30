// test/ui-features-mount.jsx
import { GlobalWindow } from "happy-dom";
import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

// app/components/Header.js
import { useState, useRef, useEffect } from "react";

// app/components/FiltersPopover.js
import { jsxDEV } from "react/jsx-dev-runtime";
"use client";
function FiltersPopover({
  provider,
  onProviderChange,
  providersList = [],
  status,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
  onResetFilters,
  onClose
}) {
  return /* @__PURE__ */ jsxDEV("div", {
    role: "dialog",
    "aria-label": "Filters and sorting",
    className: "app-popover-menu",
    children: [
      /* @__PURE__ */ jsxDEV("div", {
        style: { display: "flex", flexDirection: "column", gap: 4 },
        children: [
          /* @__PURE__ */ jsxDEV("label", {
            style: { fontSize: 11, fontWeight: 700, color: "var(--theme-text-muted)", textTransform: "uppercase" },
            children: "Provider"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("select", {
            className: "filter-select",
            value: provider,
            onChange: (e) => onProviderChange?.(e.target.value),
            "aria-label": "Filter by provider",
            children: [
              /* @__PURE__ */ jsxDEV("option", {
                value: "all",
                children: "All Providers"
              }, undefined, false, undefined, this),
              providersList.map((p) => /* @__PURE__ */ jsxDEV("option", {
                value: p,
                children: p.charAt(0).toUpperCase() + p.slice(1)
              }, p, false, undefined, this))
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        style: { display: "flex", flexDirection: "column", gap: 4 },
        children: [
          /* @__PURE__ */ jsxDEV("label", {
            style: { fontSize: 11, fontWeight: 700, color: "var(--theme-text-muted)", textTransform: "uppercase" },
            children: "Status"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("select", {
            className: "filter-select",
            value: status,
            onChange: (e) => onStatusChange?.(e.target.value),
            "aria-label": "Filter by status",
            children: [
              /* @__PURE__ */ jsxDEV("option", {
                value: "all",
                children: "All Statuses"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "healthy",
                children: "Available"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "low",
                children: "Low Quota"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "exhausted",
                children: "Exhausted"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "partial",
                children: "Partial"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "no-data",
                children: "No Data"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "inactive",
                children: "Inactive"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "unavailable",
                children: "Unavailable"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        style: { display: "flex", flexDirection: "column", gap: 4 },
        children: [
          /* @__PURE__ */ jsxDEV("label", {
            style: { fontSize: 11, fontWeight: 700, color: "var(--theme-text-muted)", textTransform: "uppercase" },
            children: "Sort By"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("select", {
            className: "filter-select",
            value: `${sortBy}:${sortOrder}`,
            onChange: (e) => {
              const [by, order] = e.target.value.split(":");
              onSortChange?.(by, order);
            },
            "aria-label": "Sort accounts",
            children: [
              /* @__PURE__ */ jsxDEV("option", {
                value: "remainingPct:asc",
                children: "Remaining % (Lowest First)"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "remainingPct:desc",
                children: "Remaining % (Highest First)"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "label:asc",
                children: "Account Name (A–Z)"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "label:desc",
                children: "Account Name (Z–A)"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("option", {
                value: "status:asc",
                children: "Status"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        style: { display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--theme-border)" },
        children: [
          onResetFilters && /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            onClick: onResetFilters,
            style: { fontSize: 12, color: "var(--theme-text-muted)", cursor: "pointer", padding: "4px" },
            children: "Reset"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            className: "btn-orange-cta",
            onClick: onClose,
            style: { height: 28, padding: "0 10px", fontSize: 12 },
            children: "Done"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// app/components/Header.js
import { jsxDEV as jsxDEV2, Fragment } from "react/jsx-dev-runtime";
"use client";
function Header({
  activeTab,
  onTabChange,
  theme,
  onToggleTheme,
  onRefresh,
  onLogout,
  refreshing,
  lastSyncAt,
  search = "",
  onSearchChange,
  activeFilter = "active",
  onActiveFilterChange,
  provider = "all",
  onProviderChange,
  providersList = [],
  status = "all",
  onStatusChange,
  sortBy = "remainingPct",
  sortOrder = "asc",
  onSortChange,
  onResetFilters,
  accountsCount = 0,
  cadence = "off",
  onCadenceChange,
  notificationPermission = "default",
  onRequestNotificationPermission,
  activeAlertsCount = 0,
  onExportCsv,
  onExportJson
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef(null);
  const filtersRef = useRef(null);
  const exportRef = useRef(null);
  const syncLabel = lastSyncAt ? `Updated ${new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}` : "Connecting…";
  const extraFiltersCount = (provider !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setFiltersOpen(false);
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  return /* @__PURE__ */ jsxDEV2(Fragment, {
    children: [
      /* @__PURE__ */ jsxDEV2("div", {
        className: "top-meta-banner",
        children: [
          /* @__PURE__ */ jsxDEV2("div", {
            className: "badge",
            children: [
              /* @__PURE__ */ jsxDEV2("span", {
                className: "badge-dot"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV2("span", {
                children: [
                  "9ROUTER · ",
                  accountsCount,
                  " ACCOUNTS"
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV2("div", {
            children: /* @__PURE__ */ jsxDEV2("span", {
              children: syncLabel.toUpperCase()
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV2("nav", {
        className: "app-navbar",
        "aria-label": "Dashboard navigation",
        children: [
          /* @__PURE__ */ jsxDEV2("div", {
            className: "brand-section",
            children: [
              /* @__PURE__ */ jsxDEV2("div", {
                className: "brand-logo-mark",
                "aria-hidden": "true",
                title: "9Router Quotas",
                children: /* @__PURE__ */ jsxDEV2("svg", {
                  width: "18",
                  height: "18",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  children: [
                    /* @__PURE__ */ jsxDEV2("polyline", {
                      points: "16 18 22 12 16 6"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV2("polyline", {
                      points: "8 6 2 12 8 18"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV2("div", {
                className: "brand-title-wrap",
                children: [
                  /* @__PURE__ */ jsxDEV2("div", {
                    className: "brand-title",
                    children: [
                      "9Router ",
                      /* @__PURE__ */ jsxDEV2("span", {
                        children: "Quotas"
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this),
                  /* @__PURE__ */ jsxDEV2("div", {
                    className: "brand-subtitle",
                    children: "QUOTA & TRAFFIC MONITOR"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV2("div", {
            className: "nav-links",
            role: "tablist",
            children: [
              /* @__PURE__ */ jsxDEV2("button", {
                type: "button",
                className: `nav-link-btn ${activeTab === "quotas" ? "active" : ""}`,
                role: "tab",
                "aria-selected": activeTab === "quotas",
                onClick: () => onTabChange("quotas"),
                children: "Quotas"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV2("button", {
                type: "button",
                className: `nav-link-btn ${activeTab === "usage" ? "active" : ""}`,
                role: "tab",
                "aria-selected": activeTab === "usage",
                onClick: () => onTabChange("usage"),
                children: "Usage"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV2("div", {
            className: "nav-actions",
            children: [
              activeTab === "quotas" && /* @__PURE__ */ jsxDEV2(Fragment, {
                children: [
                  /* @__PURE__ */ jsxDEV2("div", {
                    className: "search-box",
                    children: [
                      /* @__PURE__ */ jsxDEV2("svg", {
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        "aria-hidden": "true",
                        children: [
                          /* @__PURE__ */ jsxDEV2("circle", {
                            cx: "11",
                            cy: "11",
                            r: "8"
                          }, undefined, false, undefined, this),
                          /* @__PURE__ */ jsxDEV2("line", {
                            x1: "21",
                            y1: "21",
                            x2: "16.65",
                            y2: "16.65"
                          }, undefined, false, undefined, this)
                        ]
                      }, undefined, true, undefined, this),
                      /* @__PURE__ */ jsxDEV2("input", {
                        type: "text",
                        value: search,
                        onChange: (e) => onSearchChange?.(e.target.value),
                        placeholder: "FILTER ALIAS...",
                        autoComplete: "off",
                        "aria-label": "Filter accounts by alias or email"
                      }, undefined, false, undefined, this),
                      search && /* @__PURE__ */ jsxDEV2("button", {
                        type: "button",
                        onClick: () => onSearchChange?.(""),
                        className: "search-clear-btn",
                        "aria-label": "Clear search",
                        children: "✕"
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this),
                  /* @__PURE__ */ jsxDEV2("button", {
                    type: "button",
                    className: `active-filter-btn ${activeFilter === "active" ? "is-active" : ""}`,
                    onClick: () => onActiveFilterChange?.(activeFilter === "active" ? "all" : "active"),
                    title: "Filter active accounts",
                    "aria-pressed": activeFilter === "active",
                    children: [
                      /* @__PURE__ */ jsxDEV2("span", {
                        className: "dot-indicator"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV2("span", {
                        children: "Active Only"
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this),
                  /* @__PURE__ */ jsxDEV2("div", {
                    style: { position: "relative" },
                    ref: filtersRef,
                    children: [
                      /* @__PURE__ */ jsxDEV2("button", {
                        type: "button",
                        className: `filter-toggle-btn ${extraFiltersCount > 0 ? "is-active" : ""}`,
                        onClick: () => setFiltersOpen((prev) => !prev),
                        "aria-haspopup": "dialog",
                        "aria-expanded": filtersOpen,
                        title: "More filters and sorting options",
                        children: [
                          /* @__PURE__ */ jsxDEV2("span", {
                            children: "Filters"
                          }, undefined, false, undefined, this),
                          extraFiltersCount > 0 && /* @__PURE__ */ jsxDEV2("span", {
                            className: "filter-count-badge",
                            children: extraFiltersCount
                          }, undefined, false, undefined, this)
                        ]
                      }, undefined, true, undefined, this),
                      filtersOpen && /* @__PURE__ */ jsxDEV2(FiltersPopover, {
                        provider,
                        onProviderChange,
                        providersList,
                        status,
                        onStatusChange,
                        sortBy,
                        sortOrder,
                        onSortChange,
                        onResetFilters,
                        onClose: () => setFiltersOpen(false)
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV2("div", {
                className: "cadence-select-wrap",
                style: { display: "inline-flex", alignItems: "center" },
                children: /* @__PURE__ */ jsxDEV2("select", {
                  className: "cadence-select",
                  value: cadence,
                  onChange: (e) => onCadenceChange?.(e.target.value),
                  "aria-label": "Auto-refresh interval",
                  "data-testid": "cadence-selector",
                  style: {
                    padding: "4px 8px",
                    fontSize: 12,
                    background: "var(--theme-canvas-subtle)",
                    color: "var(--theme-text)",
                    border: "1px solid var(--theme-border)",
                    borderRadius: "var(--radius-sm, 4px)",
                    cursor: "pointer"
                  },
                  children: [
                    /* @__PURE__ */ jsxDEV2("option", {
                      value: "off",
                      children: "Sync: Off"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV2("option", {
                      value: "15s",
                      children: "Sync: 15s"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV2("option", {
                      value: "30s",
                      children: "Sync: 30s"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV2("option", {
                      value: "60s",
                      children: "Sync: 60s"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV2("option", {
                      value: "5m",
                      children: "Sync: 5m"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV2("button", {
                type: "button",
                className: `notification-toggle-btn ${notificationPermission === "granted" ? "is-granted" : ""}`,
                onClick: onRequestNotificationPermission,
                title: `Notifications: ${notificationPermission}`,
                "aria-label": `Web notifications ${notificationPermission}`,
                "data-testid": "notification-permission-btn",
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  fontSize: 12,
                  background: "var(--theme-canvas-subtle)",
                  color: notificationPermission === "granted" ? "var(--theme-green)" : notificationPermission === "denied" ? "var(--theme-red)" : "var(--theme-text-muted)",
                  border: "1px solid var(--theme-border)",
                  borderRadius: "var(--radius-sm, 4px)",
                  cursor: notificationPermission === "granted" ? "default" : "pointer"
                },
                children: [
                  /* @__PURE__ */ jsxDEV2("span", {
                    children: notificationPermission === "granted" ? "\uD83D\uDD14 Alerts On" : notificationPermission === "denied" ? "\uD83D\uDD15 Alerts Off" : "\uD83D\uDD14 Alerts"
                  }, undefined, false, undefined, this),
                  activeAlertsCount > 0 && /* @__PURE__ */ jsxDEV2("span", {
                    className: "filter-count-badge",
                    style: { backgroundColor: "var(--theme-red)", color: "#fff", marginLeft: 2 },
                    "data-testid": "alerts-count-badge",
                    children: activeAlertsCount
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV2("div", {
                style: { position: "relative" },
                ref: exportRef,
                children: [
                  /* @__PURE__ */ jsxDEV2("button", {
                    type: "button",
                    className: "export-toggle-btn",
                    onClick: () => setExportOpen((prev) => !prev),
                    "aria-haspopup": "menu",
                    "aria-expanded": exportOpen,
                    title: "Export snapshot",
                    "data-testid": "export-dropdown-btn",
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      fontSize: 12,
                      background: "var(--theme-canvas-subtle)",
                      color: "var(--theme-text)",
                      border: "1px solid var(--theme-border)",
                      borderRadius: "var(--radius-sm, 4px)",
                      cursor: "pointer"
                    },
                    children: /* @__PURE__ */ jsxDEV2("span", {
                      children: "Export ▾"
                    }, undefined, false, undefined, this)
                  }, undefined, false, undefined, this),
                  exportOpen && /* @__PURE__ */ jsxDEV2("div", {
                    role: "menu",
                    className: "app-popover-menu",
                    style: { minWidth: 120, right: 0, top: "calc(100% + 4px)", position: "absolute", zIndex: 50 },
                    children: [
                      /* @__PURE__ */ jsxDEV2("button", {
                        type: "button",
                        role: "menuitem",
                        onClick: () => {
                          setExportOpen(false);
                          onExportCsv?.();
                        },
                        className: "app-menu-item",
                        "data-testid": "export-csv-btn",
                        children: "Export CSV"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV2("button", {
                        type: "button",
                        role: "menuitem",
                        onClick: () => {
                          setExportOpen(false);
                          onExportJson?.();
                        },
                        className: "app-menu-item",
                        "data-testid": "export-json-btn",
                        children: "Export JSON"
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV2("button", {
                type: "button",
                className: "btn-orange-cta",
                onClick: onRefresh,
                disabled: refreshing,
                title: "Refresh quotas",
                "aria-label": "Refresh quotas",
                children: [
                  /* @__PURE__ */ jsxDEV2("svg", {
                    width: "14",
                    height: "14",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "2.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    children: [
                      /* @__PURE__ */ jsxDEV2("path", {
                        d: "M23 4v6h-6"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV2("path", {
                        d: "M1 20v-6h6"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV2("path", {
                        d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this),
                  /* @__PURE__ */ jsxDEV2("span", {
                    children: refreshing ? "Updating…" : "Refresh"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV2("div", {
                style: { position: "relative" },
                ref: menuRef,
                children: [
                  /* @__PURE__ */ jsxDEV2("button", {
                    type: "button",
                    className: "nav-menu-btn",
                    onClick: () => setMenuOpen((prev) => !prev),
                    "aria-haspopup": "menu",
                    "aria-expanded": menuOpen,
                    "aria-label": "Account and settings menu",
                    title: "Settings",
                    children: "•••"
                  }, undefined, false, undefined, this),
                  menuOpen && /* @__PURE__ */ jsxDEV2("div", {
                    role: "menu",
                    className: "app-popover-menu",
                    style: { minWidth: 160 },
                    children: [
                      /* @__PURE__ */ jsxDEV2("button", {
                        type: "button",
                        role: "menuitem",
                        onClick: () => {
                          setMenuOpen(false);
                          onToggleTheme?.();
                        },
                        className: "app-menu-item",
                        children: [
                          /* @__PURE__ */ jsxDEV2("span", {
                            children: "Theme"
                          }, undefined, false, undefined, this),
                          /* @__PURE__ */ jsxDEV2("span", {
                            style: { fontSize: 12, color: "var(--theme-text-muted)" },
                            children: theme === "dark" ? "Dark" : "Light"
                          }, undefined, false, undefined, this)
                        ]
                      }, undefined, true, undefined, this),
                      /* @__PURE__ */ jsxDEV2("div", {
                        style: { height: 1, backgroundColor: "var(--theme-border)", margin: "2px 0" }
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV2("button", {
                        type: "button",
                        role: "menuitem",
                        onClick: () => {
                          setMenuOpen(false);
                          onLogout?.();
                        },
                        className: "app-menu-item",
                        style: { color: "var(--theme-red)" },
                        children: "Sign Out"
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// app/components/DetailSheet.js
import { useState as useState3, useEffect as useEffect3, useRef as useRef2 } from "react";

// app/components/StatusPill.js
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
"use client";
function StatusPill({ statusObj, suppressAvailable = true }) {
  const status = statusObj?.status || "no-data";
  const label = statusObj?.label || "No Data";
  if (suppressAvailable && (status === "healthy" || label === "Available")) {
    return null;
  }
  if (status === "healthy") {
    return /* @__PURE__ */ jsxDEV3("span", {
      className: "pp-tag-active",
      title: statusObj?.reason || label,
      children: label
    }, undefined, false, undefined, this);
  }
  if (status === "low" || status === "stale" || status === "partial") {
    return /* @__PURE__ */ jsxDEV3("span", {
      className: "pp-tag-low",
      title: statusObj?.reason || label,
      children: label
    }, undefined, false, undefined, this);
  }
  if (status === "exhausted") {
    return /* @__PURE__ */ jsxDEV3("span", {
      className: "pp-tag-depleted",
      title: statusObj?.reason || label,
      children: label
    }, undefined, false, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV3("span", {
    className: "pp-tag-disabled",
    title: statusObj?.reason || label,
    children: label
  }, undefined, false, undefined, this);
}

// lib/client/useCentralClock.js
import { useState as useState2, useEffect as useEffect2 } from "react";
"use client";
var sharedNowMs = typeof Date !== "undefined" ? Date.now() : 0;
var subscribers = new Set;
var timerId = null;
function ensureTimer() {
  if (timerId === null && typeof setInterval !== "undefined") {
    timerId = setInterval(() => {
      sharedNowMs = Date.now();
      for (const sub of subscribers) {
        sub(sharedNowMs);
      }
    }, 1000);
    if (typeof timerId?.unref === "function") {
      timerId.unref();
    }
  }
}
function stopTimerIfNoSubscribers() {
  if (subscribers.size === 0 && timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}
function useCentralClock(intervalMs = 1000) {
  const [nowMs, setNowMs] = useState2(() => typeof Date !== "undefined" ? Date.now() : 0);
  useEffect2(() => {
    const handleTick = (now) => setNowMs(now);
    subscribers.add(handleTick);
    ensureTimer();
    return () => {
      subscribers.delete(handleTick);
      stopTimerIfNoSubscribers();
    };
  }, [intervalMs]);
  return nowMs;
}

// lib/client/formatters.js
function formatPercent(percent, unlimited = false) {
  if (unlimited)
    return "Unlimited";
  if (percent === null || percent === undefined || Number.isNaN(percent)) {
    return "—";
  }
  return `${Math.round(percent)}%`;
}
function formatUnits(used, total, unit = "") {
  const cleanUnit = unit ? ` ${unit}` : "";
  if (used === null && total === null) {
    return "—";
  }
  if (used !== null && total !== null) {
    return `${formatNumber(used)} / ${formatNumber(total)}${cleanUnit}`;
  }
  if (used !== null) {
    return `${formatNumber(used)}${cleanUnit} used`;
  }
  return `${formatNumber(total)}${cleanUnit} limit`;
}
function computeResetCountdown(resetAt, nowMs = Date.now(), options = {}) {
  if (options.unlimited || !resetAt) {
    return { text: "—", diffMs: 0, status: "unlimited" };
  }
  const target = new Date(resetAt).getTime();
  if (Number.isNaN(target)) {
    return { text: "—", diffMs: 0, status: "invalid" };
  }
  const diffMs = target - nowMs;
  if (diffMs <= 0) {
    return { text: "due to reset", diffMs: 0, status: "due" };
  }
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  let text;
  if (diffDays > 0) {
    const remHours = diffHours % 24;
    text = remHours > 0 ? `in ${diffDays}d ${remHours}h` : `in ${diffDays}d`;
  } else if (diffHours > 0) {
    const remMin = diffMin % 60;
    text = remMin > 0 ? `in ${diffHours}h ${remMin}m` : `in ${diffHours}h`;
  } else if (diffMin > 0) {
    text = `in ${diffMin}m`;
  } else {
    text = `in ${Math.max(1, diffSec)}s`;
  }
  return { text, diffMs, status: "active" };
}
function formatExactDate(isoString) {
  if (!isoString)
    return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime()))
    return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}
function formatNumber(num) {
  if (num === null || num === undefined || Number.isNaN(num))
    return "—";
  return Number(num).toLocaleString("en-US");
}
function formatTokens(num) {
  if (num === null || num === undefined || Number.isNaN(num))
    return "—";
  const val = Math.abs(num);
  if (val >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  }
  if (val >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (val >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
function formatCost(cost) {
  if (cost === null || cost === undefined || Number.isNaN(cost))
    return "—";
  return `$${Number(cost).toFixed(2)}`;
}
// lib/client/accountPresentation.js
function maskEmail(emailOrIdentity) {
  if (!emailOrIdentity || typeof emailOrIdentity !== "string")
    return "";
  const trimmed = emailOrIdentity.trim();
  if (!trimmed)
    return "";
  const atIdx = trimmed.indexOf("@");
  if (atIdx > 0) {
    const local = trimmed.slice(0, atIdx);
    const domain = trimmed.slice(atIdx + 1);
    if (local.includes("***")) {
      return `${local}@${domain}`;
    }
    const prefixLen = Math.min(5, local.length);
    const prefix = local.slice(0, prefixLen);
    return `${prefix}***@${domain}`;
  }
  if (trimmed.includes("***"))
    return trimmed;
  if (trimmed.length > 8) {
    return `${trimmed.slice(0, 8)}***`;
  }
  return `${trimmed}***`;
}
// lib/client/selectors.js
function aggregateUsageByProvider(stats = {}, connections = []) {
  const totals = stats?.totals || { totalTokens: 0, requests: 0, estimatedCost: 0 };
  const totalTokens = totals.totalTokens || 0;
  const totalRequests = totals.requests || 0;
  const totalCost = totals.estimatedCost || 0;
  const rawAccounts = Array.isArray(stats?.accounts) ? stats.accounts : [];
  if (rawAccounts.length === 0) {
    return {
      status: "unavailable",
      available: false,
      notice: "Upstream usage breakdown unavailable for this period",
      providers: [],
      accounts: [],
      totals
    };
  }
  const connMap = new Map;
  for (const c of connections) {
    if (c && c.id)
      connMap.set(String(c.id), c);
  }
  const providerMap = new Map;
  const getProviderEntry = (name) => {
    const key = (name || "unassigned").toLowerCase();
    if (!providerMap.has(key)) {
      providerMap.set(key, {
        provider: key,
        tokens: 0,
        requests: 0,
        cost: 0,
        accountCount: 0
      });
    }
    return providerMap.get(key);
  };
  const accountRows = [];
  let accountedTokens = 0;
  let accountedRequests = 0;
  let accountedCost = 0;
  for (const acc of rawAccounts) {
    const conn = connMap.get(String(acc.connectionId));
    const providerName = conn?.provider || "unassigned";
    const entry = getProviderEntry(providerName);
    const tokens = acc.totalTokens || 0;
    const requests = acc.requests || 0;
    const cost = acc.estimatedCost || 0;
    entry.tokens += tokens;
    entry.requests += requests;
    entry.cost += cost;
    entry.accountCount += 1;
    accountedTokens += tokens;
    accountedRequests += requests;
    accountedCost += cost;
    accountRows.push({
      connectionId: acc.connectionId,
      alias: conn?.label || conn?.id || acc.connectionId,
      provider: providerName,
      totalTokens: tokens,
      requests,
      estimatedCost: cost,
      tokenPct: totalTokens > 0 ? tokens / totalTokens * 100 : 0
    });
  }
  const tokenRemainder = Math.max(0, totalTokens - accountedTokens);
  const requestsRemainder = Math.max(0, totalRequests - accountedRequests);
  const costRemainder = Math.max(0, totalCost - accountedCost);
  if (tokenRemainder > 0 || requestsRemainder > 0 || costRemainder > 0) {
    const unassignedEntry = getProviderEntry("unassigned");
    unassignedEntry.tokens += tokenRemainder;
    unassignedEntry.requests += requestsRemainder;
    unassignedEntry.cost += costRemainder;
  }
  const providers = Array.from(providerMap.values()).map((p) => ({
    ...p,
    tokenPct: totalTokens > 0 ? p.tokens / totalTokens * 100 : 0,
    requestPct: totalRequests > 0 ? p.requests / totalRequests * 100 : 0
  }));
  return {
    status: "ok",
    available: true,
    notice: null,
    providers,
    accounts: accountRows,
    totals
  };
}

// app/components/DetailSheet.js
import { jsxDEV as jsxDEV4 } from "react/jsx-dev-runtime";
"use client";
function DetailSheet({
  account,
  onClose,
  onRefreshQuota,
  isRefreshingQuota = false,
  onToggleGovernor,
  isTogglingGovernor = false
}) {
  const previousFocusRef = useRef2(null);
  const nowMs = useCentralClock();
  const [cooldownSec, setCooldownSec] = useState3(0);
  const [governorState, setGovernorState] = useState3(null);
  useEffect3(() => {
    previousFocusRef.current = document.activeElement;
    const handleKeyDown = (e) => {
      if (e.key === "Escape")
        onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [onClose]);
  useEffect3(() => {
    if (cooldownSec <= 0)
      return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    if (typeof timer?.unref === "function") {
      timer.unref();
    }
    return () => clearInterval(timer);
  }, [cooldownSec]);
  if (!account)
    return null;
  const { id, provider, active, quota, effectiveStatus } = account;
  const alias = account.displayAlias || account.label || id;
  const maskedIdentity = account.maskedIdentity || maskEmail(id);
  const shortId = account.shortId || (id.length > 12 ? `${id.slice(0, 8)}...` : id);
  const windows = Array.isArray(quota?.windows) ? quota.windows : [];
  const currentActive = governorState !== null ? governorState.active : account.overrideActive ?? active;
  const mode = governorState?.mode || (account.isOverride ? "simulated" : null);
  const notice = governorState?.notice || null;
  const handleRefresh = async () => {
    if (!onRefreshQuota || isRefreshingQuota || cooldownSec > 0)
      return;
    const res = await onRefreshQuota(id);
    if (res?.rateLimited || res?.error?.status === 429) {
      setCooldownSec(5);
    }
  };
  const handleGovernorToggle = async (e) => {
    const nextActive = e.target.checked;
    if (!onToggleGovernor) {
      setGovernorState({ active: nextActive, mode: "simulated", notice: "Dashboard Override (Router Read-Only)" });
      return;
    }
    const res = await onToggleGovernor(id, nextActive);
    if (res && res.success) {
      setGovernorState({ active: res.active, mode: res.mode, notice: res.notice });
    }
  };
  return /* @__PURE__ */ jsxDEV4("div", {
    className: "quota-modal-backdrop is-open",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "sheet-title",
    onClick: onClose,
    children: /* @__PURE__ */ jsxDEV4("div", {
      className: "quota-modal",
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxDEV4("div", {
          className: "quota-modal-header",
          children: [
            /* @__PURE__ */ jsxDEV4("div", {
              id: "sheet-title",
              className: "quota-modal-title",
              children: [
                alias,
                " · Full Details"
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV4("button", {
              type: "button",
              className: "modal-close-btn",
              onClick: onClose,
              "aria-label": "Close details",
              children: "✕"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV4("div", {
          className: "quota-modal-body",
          children: [
            /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Pool Identity"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "val",
                  children: maskedIdentity
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Connection ID"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "val",
                  children: shortId
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Provider"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "val",
                  style: { textTransform: "capitalize" },
                  children: provider
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Status"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "val",
                  style: { display: "inline-flex", alignItems: "center", gap: 6 },
                  children: [
                    /* @__PURE__ */ jsxDEV4(StatusPill, {
                      statusObj: effectiveStatus,
                      suppressAvailable: false
                    }, undefined, false, undefined, this),
                    !currentActive && /* @__PURE__ */ jsxDEV4("span", {
                      className: "pp-tag-disabled",
                      children: "Disabled"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              style: { alignItems: "center" },
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Quota Refresh"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("div", {
                  className: "val",
                  style: { display: "inline-flex", alignItems: "center", gap: 8 },
                  children: [
                    /* @__PURE__ */ jsxDEV4("button", {
                      type: "button",
                      className: "btn-orange-cta",
                      style: { padding: "4px 10px", fontSize: 12 },
                      disabled: isRefreshingQuota || cooldownSec > 0,
                      onClick: handleRefresh,
                      "data-testid": "refresh-account-quota-btn",
                      children: isRefreshingQuota ? "Refreshing…" : cooldownSec > 0 ? `Wait ${cooldownSec}s` : "Refresh Quota"
                    }, undefined, false, undefined, this),
                    cooldownSec > 0 && /* @__PURE__ */ jsxDEV4("span", {
                      style: { fontSize: 11, color: "var(--theme-amber)" },
                      children: "Rate limited (5s cooldown)"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              style: { alignItems: "center" },
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Governor Active"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("div", {
                  className: "val",
                  style: { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
                  children: [
                    /* @__PURE__ */ jsxDEV4("label", {
                      style: { display: "inline-flex", alignItems: "center", cursor: "pointer", gap: 6 },
                      children: [
                        /* @__PURE__ */ jsxDEV4("input", {
                          type: "checkbox",
                          checked: currentActive,
                          disabled: isTogglingGovernor,
                          onChange: handleGovernorToggle,
                          "data-testid": "governor-active-toggle"
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV4("span", {
                          style: { fontSize: 13, fontWeight: 500 },
                          children: currentActive ? "Active" : "Disabled"
                        }, undefined, false, undefined, this)
                      ]
                    }, undefined, true, undefined, this),
                    mode && /* @__PURE__ */ jsxDEV4("span", {
                      style: {
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        backgroundColor: mode === "simulated" ? "var(--theme-amber-tint, #fef3c7)" : "var(--theme-green-tint, #dcfce7)",
                        color: mode === "simulated" ? "var(--theme-amber, #b45309)" : "var(--theme-green, #15803d)",
                        border: `1px solid ${mode === "simulated" ? "var(--theme-amber, #b45309)" : "var(--theme-green, #15803d)"}`
                      },
                      "data-testid": "governor-mode-badge",
                      children: mode === "simulated" ? "Dashboard Override (Router Read-Only)" : "Upstream Managed"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              ]
            }, undefined, true, undefined, this),
            notice && /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              style: { marginTop: -4 },
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("span", {
                  style: { fontSize: 11, color: "var(--theme-amber)" },
                  children: notice
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            quota?.plan && /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Plan"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "val",
                  children: quota.plan
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            windows.map((w, idx) => {
              const cd = computeResetCountdown(w.resetAt, nowMs, { unlimited: w.unlimited });
              return /* @__PURE__ */ jsxDEV4("div", {
                className: "modal-detail-row",
                children: [
                  /* @__PURE__ */ jsxDEV4("span", {
                    className: "label",
                    children: w.label || w.key
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4("div", {
                    style: { textAlign: "right" },
                    children: [
                      /* @__PURE__ */ jsxDEV4("div", {
                        className: "val tabular-nums",
                        style: { display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" },
                        children: [
                          /* @__PURE__ */ jsxDEV4("span", {
                            children: [
                              formatPercent(w.remainingPercent, w.unlimited),
                              " remaining"
                            ]
                          }, undefined, true, undefined, this),
                          w.resetAt && cd.text !== "—" && /* @__PURE__ */ jsxDEV4("span", {
                            style: {
                              fontSize: 11,
                              padding: "1px 6px",
                              borderRadius: 4,
                              backgroundColor: cd.status === "due" ? "var(--theme-red-tint, #fee2e2)" : "var(--theme-canvas-subtle)",
                              color: cd.status === "due" ? "var(--theme-red)" : "var(--theme-text-muted)"
                            },
                            children: cd.text
                          }, undefined, false, undefined, this)
                        ]
                      }, undefined, true, undefined, this),
                      /* @__PURE__ */ jsxDEV4("div", {
                        style: { fontSize: 11, color: "var(--theme-text-muted)", marginTop: 2 },
                        children: [
                          formatUnits(w.used, w.total, w.unit),
                          w.resetAt ? ` · Reset: ${formatExactDate(w.resetAt)}` : ""
                        ]
                      }, undefined, true, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, w.key || idx, true, undefined, this);
            }),
            windows.length === 0 && quota?.reason && /* @__PURE__ */ jsxDEV4("div", {
              className: "modal-detail-row",
              children: [
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "label",
                  children: "Notice"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4("span", {
                  className: "val",
                  children: quota.reason
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV4("div", {
              style: { marginTop: 12 },
              children: /* @__PURE__ */ jsxDEV4("button", {
                type: "button",
                className: "btn-orange-cta",
                style: { width: "100%", justifyContent: "center" },
                onClick: onClose,
                children: "Close Details"
              }, undefined, false, undefined, this)
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}

// app/components/QuotaWindowCell.js
import { jsxDEV as jsxDEV5 } from "react/jsx-dev-runtime";
"use client";
function formatCompactNumber(num) {
  if (num === null || num === undefined)
    return "";
  if (num >= 1e6) {
    const v = (num / 1e6).toFixed(1).replace(/\.0$/, "");
    return `${v}M`;
  }
  if (num >= 1000) {
    const v = (num / 1000).toFixed(1).replace(/\.0$/, "");
    return `${v}k`;
  }
  return String(num);
}
function formatCompactUsageText(used, total) {
  if (used === null || used === undefined)
    return "";
  if (total === null || total === undefined)
    return `${formatCompactNumber(used)} used`;
  return `${formatCompactNumber(used)}/${formatCompactNumber(total)} used`;
}
function QuotaWindowCell({ windowData }) {
  const nowMs = useCentralClock();
  if (!windowData) {
    return /* @__PURE__ */ jsxDEV5("div", {
      className: "pp-quota-cell",
      children: [
        /* @__PURE__ */ jsxDEV5("div", {
          className: "pp-quota-value-row",
          children: [
            /* @__PURE__ */ jsxDEV5("span", {
              className: "pp-quota-pct",
              style: { color: "var(--theme-text-muted)" },
              children: "—"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV5("span", {
              className: "pp-quota-pct-label",
              children: "rem"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV5("div", {
          className: "pp-bar-track",
          children: /* @__PURE__ */ jsxDEV5("div", {
            className: "pp-bar-fill",
            style: { width: "0%" }
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV5("div", {
          className: "pp-quota-meta",
          children: [
            /* @__PURE__ */ jsxDEV5("span", {
              className: "reset",
              children: "—"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV5("span", {
              className: "used",
              children: "—"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  const { remainingPercent, used, total, resetAt, unlimited } = windowData;
  const pctStr = formatPercent(remainingPercent, unlimited);
  const countdown = computeResetCountdown(resetAt, nowMs, { unlimited });
  const rawResetRel = countdown.text;
  const resetStr = rawResetRel ? rawResetRel.replace(/^in\s+/, "") : "—";
  const usageStr = formatCompactUsageText(used, total);
  const exactDateStr = formatExactDate(resetAt);
  let pctColorClass = "";
  let barColorClass = "green";
  let resetStyle = {};
  if (unlimited) {
    barColorClass = "green";
  } else if (remainingPercent === 0) {
    pctColorClass = "red";
    barColorClass = "red";
    resetStyle = { color: "var(--theme-red)" };
  } else if (typeof remainingPercent === "number" && remainingPercent < 20) {
    pctColorClass = "amber";
    barColorClass = "amber";
    resetStyle = { color: "var(--theme-amber)" };
  } else if (typeof remainingPercent === "number") {
    barColorClass = "green";
  }
  const fillWidth = unlimited ? 100 : typeof remainingPercent === "number" ? Math.min(Math.max(remainingPercent, 0), 100) : 0;
  return /* @__PURE__ */ jsxDEV5("div", {
    className: "pp-quota-cell",
    title: resetAt ? `Resets: ${exactDateStr}` : undefined,
    children: [
      /* @__PURE__ */ jsxDEV5("div", {
        className: "pp-quota-value-row",
        children: [
          /* @__PURE__ */ jsxDEV5("span", {
            className: `pp-quota-pct ${pctColorClass}`,
            children: pctStr
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5("span", {
            className: "pp-quota-pct-label",
            children: unlimited ? "unlimited" : "rem"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV5("div", {
        className: "pp-bar-track",
        "aria-hidden": "true",
        children: /* @__PURE__ */ jsxDEV5("div", {
          className: `pp-bar-fill ${barColorClass}`,
          style: { width: `${fillWidth}%` }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV5("div", {
        className: "pp-quota-meta",
        children: [
          /* @__PURE__ */ jsxDEV5("span", {
            className: "reset",
            style: resetStyle,
            children: resetStr
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5("span", {
            className: "used",
            children: usageStr || "—"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// app/components/UsageView.js
import { jsxDEV as jsxDEV6 } from "react/jsx-dev-runtime";
"use client";
function UsageView({
  stats,
  loading,
  error,
  period,
  onPeriodChange,
  connections = []
}) {
  const totals = stats?.totals || {};
  const chartPoints = Array.isArray(stats?.chart) ? stats.chart : [];
  const maxTokens = Math.max(...chartPoints.map((p) => p.tokens || 0), 1);
  const breakdown = aggregateUsageByProvider(stats, connections);
  return /* @__PURE__ */ jsxDEV6("div", {
    style: { display: "flex", flexDirection: "column", gap: 16 },
    children: [
      /* @__PURE__ */ jsxDEV6("div", {
        className: "pp-card",
        style: {
          padding: "12px 18px",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12
        },
        children: [
          /* @__PURE__ */ jsxDEV6("div", {
            children: [
              /* @__PURE__ */ jsxDEV6("h2", {
                style: { fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.01 },
                children: "9Router Usage & Traffic"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("p", {
                style: { fontSize: 12, color: "var(--theme-text-muted)", marginTop: 2 },
                children: [
                  "Scope: ",
                  /* @__PURE__ */ jsxDEV6("strong", {
                    children: "All Router Traffic"
                  }, undefined, false, undefined, this),
                  " (system-wide global metrics, unaffected by account filters)"
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV6("div", {
            className: "nav-links",
            children: ["24h", "7d", "30d"].map((p) => /* @__PURE__ */ jsxDEV6("button", {
              type: "button",
              className: `nav-link-btn ${period === p ? "active" : ""}`,
              onClick: () => onPeriodChange(p),
              disabled: loading,
              style: {
                color: period === p ? "var(--theme-dark)" : "var(--theme-text-muted)",
                background: period === p ? "var(--theme-canvas-subtle)" : "transparent",
                border: period === p ? "1px solid var(--theme-border-strong)" : "none"
              },
              children: p.toUpperCase()
            }, p, false, undefined, this))
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      error && /* @__PURE__ */ jsxDEV6("div", {
        style: { padding: "12px 16px", backgroundColor: "var(--theme-red-tint)", color: "var(--theme-red)", borderRadius: "var(--radius-sm)", fontSize: 13 },
        children: error
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10
        },
        children: [
          /* @__PURE__ */ jsxDEV6("div", {
            className: "pp-card",
            style: { padding: "14px 18px" },
            children: [
              /* @__PURE__ */ jsxDEV6("span", {
                style: { fontSize: 12, color: "var(--theme-text-muted)", fontWeight: 600, textTransform: "uppercase" },
                children: "Total Requests"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                style: { fontSize: 24, fontWeight: 700, marginTop: 4 },
                className: "tabular-nums",
                children: loading ? "…" : formatNumber(totals.requests)
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV6("div", {
            className: "pp-card",
            style: { padding: "14px 18px" },
            children: [
              /* @__PURE__ */ jsxDEV6("span", {
                style: { fontSize: 12, color: "var(--theme-text-muted)", fontWeight: 600, textTransform: "uppercase" },
                children: "Total Tokens"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                style: { fontSize: 24, fontWeight: 700, marginTop: 4 },
                className: "tabular-nums",
                children: loading ? "…" : formatTokens(totals.totalTokens)
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV6("div", {
            className: "pp-card",
            style: { padding: "14px 18px" },
            children: [
              /* @__PURE__ */ jsxDEV6("span", {
                style: { fontSize: 12, color: "var(--theme-text-muted)", fontWeight: 600, textTransform: "uppercase" },
                children: "Input / Output"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                style: { fontSize: 15, fontWeight: 600, marginTop: 6 },
                className: "tabular-nums",
                children: loading ? "…" : `${formatTokens(totals.inputTokens)} in • ${formatTokens(totals.outputTokens)} out`
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                style: { fontSize: 12, color: "var(--theme-text-muted)", marginTop: 2 },
                children: [
                  "Cached: ",
                  loading ? "…" : formatTokens(totals.cachedTokens)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV6("div", {
            className: "pp-card",
            style: { padding: "14px 18px" },
            children: [
              /* @__PURE__ */ jsxDEV6("span", {
                style: { fontSize: 12, color: "var(--theme-text-muted)", fontWeight: 600, textTransform: "uppercase" },
                children: "Estimated Cost"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                style: { fontSize: 24, fontWeight: 700, marginTop: 4, color: "var(--theme-orange)" },
                className: "tabular-nums",
                children: loading ? "…" : formatCost(totals.estimatedCost)
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "pp-card",
        style: { padding: "16px 20px" },
        children: [
          /* @__PURE__ */ jsxDEV6("h3", {
            style: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 14 },
            children: [
              "Token Volume Over Time (",
              period.toUpperCase(),
              ")"
            ]
          }, undefined, true, undefined, this),
          chartPoints.length === 0 ? /* @__PURE__ */ jsxDEV6("div", {
            style: { padding: "32px 0", textAlign: "center", color: "var(--theme-text-muted)" },
            children: stats?.chartStatus === "unavailable" ? "Chart data unavailable for this period." : "No chart activity recorded."
          }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV6("div", {
            style: {
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              height: 180,
              paddingTop: 24,
              borderBottom: "1px solid var(--theme-border)",
              paddingBottom: 8
            },
            children: chartPoints.map((pt, idx) => {
              const heightPct = Math.max(4, Math.round((pt.tokens || 0) / maxTokens * 100));
              return /* @__PURE__ */ jsxDEV6("div", {
                style: {
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end"
                },
                title: `${pt.label}: ${formatTokens(pt.tokens)} tokens (${formatCost(pt.estimatedCost)})`,
                children: [
                  /* @__PURE__ */ jsxDEV6("div", {
                    style: {
                      width: "100%",
                      maxHeight: "100%",
                      height: `${heightPct}%`,
                      backgroundColor: "var(--theme-orange)",
                      borderRadius: "2px 2px 0 0"
                    }
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV6("span", {
                    style: {
                      fontSize: 11,
                      color: "var(--theme-text-muted)",
                      marginTop: 6,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 60
                    },
                    children: pt.label
                  }, undefined, false, undefined, this)
                ]
              }, idx, true, undefined, this);
            })
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "pp-card",
        style: { padding: 18 },
        "data-testid": "provider-distribution-section",
        children: [
          /* @__PURE__ */ jsxDEV6("h3", {
            style: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 },
            children: "Provider Distribution"
          }, undefined, false, undefined, this),
          breakdown.status === "unavailable" ? /* @__PURE__ */ jsxDEV6("div", {
            style: { padding: "16px 0", color: "var(--theme-text-muted)", fontSize: 13 },
            children: breakdown.notice
          }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV6("div", {
            style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
            children: breakdown.providers.map((p) => /* @__PURE__ */ jsxDEV6("div", {
              style: {
                padding: 12,
                borderRadius: "var(--radius-sm, 4px)",
                background: "var(--theme-canvas-subtle)",
                border: "1px solid var(--theme-border)"
              },
              "data-testid": `provider-card-${p.provider}`,
              children: [
                /* @__PURE__ */ jsxDEV6("div", {
                  style: { fontSize: 13, fontWeight: 600, textTransform: "capitalize", color: "var(--theme-text)" },
                  children: p.provider
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV6("div", {
                  style: { fontSize: 20, fontWeight: 700, color: "var(--theme-orange)", marginTop: 4 },
                  children: [
                    Math.round(p.tokenPct),
                    "%"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV6("div", {
                  style: { fontSize: 11, color: "var(--theme-text-muted)", marginTop: 2 },
                  children: [
                    formatTokens(p.tokens),
                    " tokens · ",
                    formatNumber(p.requests),
                    " reqs (",
                    Math.round(p.requestPct),
                    "%)"
                  ]
                }, undefined, true, undefined, this)
              ]
            }, p.provider, true, undefined, this))
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "pp-card",
        style: { padding: 18 },
        "data-testid": "account-breakdown-section",
        children: [
          /* @__PURE__ */ jsxDEV6("h3", {
            style: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 },
            children: "Account Consumption Breakdown"
          }, undefined, false, undefined, this),
          breakdown.status === "unavailable" || breakdown.accounts.length === 0 ? /* @__PURE__ */ jsxDEV6("div", {
            style: { padding: "16px 0", color: "var(--theme-text-muted)", fontSize: 13 },
            children: breakdown.notice || "No account activity recorded."
          }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV6("div", {
            style: { overflowX: "auto" },
            children: /* @__PURE__ */ jsxDEV6("table", {
              style: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
              children: [
                /* @__PURE__ */ jsxDEV6("thead", {
                  children: /* @__PURE__ */ jsxDEV6("tr", {
                    style: { borderBottom: "1px solid var(--theme-border)", textAlign: "left", color: "var(--theme-text-muted)" },
                    children: [
                      /* @__PURE__ */ jsxDEV6("th", {
                        style: { padding: "8px 12px" },
                        children: "Account"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("th", {
                        style: { padding: "8px 12px" },
                        children: "Provider"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("th", {
                        style: { padding: "8px 12px", textAlign: "right" },
                        children: "Tokens"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("th", {
                        style: { padding: "8px 12px", textAlign: "right" },
                        children: "Share %"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("th", {
                        style: { padding: "8px 12px", textAlign: "right" },
                        children: "Requests"
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("th", {
                        style: { padding: "8px 12px", textAlign: "right" },
                        children: "Cost"
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV6("tbody", {
                  children: breakdown.accounts.map((acc, idx) => /* @__PURE__ */ jsxDEV6("tr", {
                    style: { borderBottom: "1px solid var(--theme-border-subtle, #eee)" },
                    children: [
                      /* @__PURE__ */ jsxDEV6("td", {
                        style: { padding: "8px 12px", fontWeight: 500 },
                        children: acc.alias
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("td", {
                        style: { padding: "8px 12px", textTransform: "capitalize" },
                        children: acc.provider
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("td", {
                        style: { padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
                        children: formatTokens(acc.totalTokens)
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("td", {
                        style: { padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
                        children: [
                          Math.round(acc.tokenPct),
                          "%"
                        ]
                      }, undefined, true, undefined, this),
                      /* @__PURE__ */ jsxDEV6("td", {
                        style: { padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
                        children: formatNumber(acc.requests)
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("td", {
                        style: { padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
                        children: formatCost(acc.estimatedCost)
                      }, undefined, false, undefined, this)
                    ]
                  }, acc.connectionId || idx, true, undefined, this))
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// test/ui-features-mount.jsx
import { jsxDEV as jsxDEV7 } from "react/jsx-dev-runtime";
var window = new GlobalWindow({ url: "http://127.0.0.1:20130" });
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLSelectElement = window.HTMLSelectElement;
globalThis.HTMLButtonElement = window.HTMLButtonElement;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.Blob = window.Blob;
globalThis.URL = window.URL;
globalThis.Notification = {
  permission: "default",
  requestPermission: async () => "granted"
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test("Header mounts, handles cadence selection, alert permissions, and export dropdown", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let selectedCadence = "off";
  let csvExportTriggered = false;
  let jsonExportTriggered = false;
  let permRequested = false;
  await act(async () => {
    root.render(/* @__PURE__ */ jsxDEV7(Header, {
      activeTab: "quotas",
      onTabChange: () => {},
      theme: "light",
      onToggleTheme: () => {},
      onRefresh: () => {},
      onLogout: () => {},
      refreshing: false,
      lastSyncAt: new Date().toISOString(),
      accountsCount: 10,
      cadence: selectedCadence,
      onCadenceChange: (val) => {
        selectedCadence = val;
      },
      notificationPermission: "default",
      onRequestNotificationPermission: () => {
        permRequested = true;
      },
      activeAlertsCount: 2,
      onExportCsv: () => {
        csvExportTriggered = true;
      },
      onExportJson: () => {
        jsonExportTriggered = true;
      }
    }, undefined, false, undefined, this));
  });
  const cadenceSelect = container.querySelector('[data-testid="cadence-selector"]');
  assert.ok(cadenceSelect);
  assert.equal(cadenceSelect.value, "off");
  await act(async () => {
    cadenceSelect.value = "30s";
    cadenceSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(selectedCadence, "30s");
  const notifBtn = container.querySelector('[data-testid="notification-permission-btn"]');
  assert.ok(notifBtn);
  await act(async () => {
    notifBtn.click();
  });
  assert.equal(permRequested, true);
  const alertsBadge = container.querySelector('[data-testid="alerts-count-badge"]');
  assert.ok(alertsBadge);
  assert.equal(alertsBadge.textContent.trim(), "2");
  const exportDropdownBtn = container.querySelector('[data-testid="export-dropdown-btn"]');
  assert.ok(exportDropdownBtn);
  await act(async () => {
    exportDropdownBtn.click();
  });
  const csvBtn = container.querySelector('[data-testid="export-csv-btn"]');
  const jsonBtn = container.querySelector('[data-testid="export-json-btn"]');
  assert.ok(csvBtn);
  assert.ok(jsonBtn);
  await act(async () => {
    csvBtn.click();
  });
  assert.equal(csvExportTriggered, true);
  await act(async () => {
    exportDropdownBtn.click();
  });
  const jsonBtnAfterReopen = container.querySelector('[data-testid="export-json-btn"]');
  assert.ok(jsonBtnAfterReopen);
  await act(async () => {
    jsonBtnAfterReopen.click();
  });
  assert.equal(jsonExportTriggered, true);
  await act(async () => {
    root.unmount();
  });
  container.remove();
});
test("DetailSheet mounts, handles quota force-refresh, and toggles governor mode", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let refreshedId = null;
  let governorToggledArgs = null;
  const mockAccount = {
    id: "conn-alpha",
    displayAlias: "developer@example.com",
    provider: "codex",
    active: true,
    effectiveStatus: { status: "available", label: "Available" },
    quota: {
      plan: "Team",
      windows: [
        {
          label: "5-Hour",
          remainingPercent: 75,
          used: 250,
          total: 1000,
          unit: "tokens",
          resetAt: new Date(Date.now() + 45000).toISOString()
        }
      ]
    }
  };
  await act(async () => {
    root.render(/* @__PURE__ */ jsxDEV7(DetailSheet, {
      account: mockAccount,
      onClose: () => {},
      onRefreshQuota: async (id) => {
        refreshedId = id;
        return { success: true };
      },
      isRefreshingQuota: false,
      onToggleGovernor: async (id, active) => {
        governorToggledArgs = { id, active };
        return {
          success: true,
          id,
          active,
          mode: "simulated",
          notice: "Upstream 9router read-only. Effective in dashboard display only."
        };
      },
      isTogglingGovernor: false
    }, undefined, false, undefined, this));
  });
  const refreshBtn = container.querySelector('[data-testid="refresh-account-quota-btn"]');
  assert.ok(refreshBtn);
  assert.equal(refreshBtn.textContent.trim(), "Refresh Quota");
  await act(async () => {
    refreshBtn.click();
  });
  assert.equal(refreshedId, "conn-alpha");
  const governorToggle = container.querySelector('[data-testid="governor-active-toggle"]');
  assert.ok(governorToggle);
  assert.equal(governorToggle.checked, true);
  await act(async () => {
    governorToggle.click();
  });
  assert.deepEqual(governorToggledArgs, { id: "conn-alpha", active: false });
  const badge = container.querySelector('[data-testid="governor-mode-badge"]');
  assert.ok(badge);
  assert.equal(badge.textContent.trim(), "Dashboard Override (Router Read-Only)");
  await act(async () => {
    root.unmount();
  });
  container.remove();
});
test("QuotaWindowCell mounts and renders live ticking countdown", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const windowData = {
    remainingPercent: 60,
    used: 400,
    total: 1000,
    resetAt: new Date(Date.now() + 45000).toISOString(),
    unlimited: false
  };
  await act(async () => {
    root.render(/* @__PURE__ */ jsxDEV7(QuotaWindowCell, {
      windowData
    }, undefined, false, undefined, this));
  });
  const pct = container.querySelector(".pp-quota-pct");
  assert.ok(pct);
  assert.equal(pct.textContent.trim(), "60%");
  const meta = container.querySelector(".pp-quota-meta");
  assert.ok(meta);
  assert.match(meta.textContent, /(?:44s|45s)/);
  await act(async () => {
    root.unmount();
  });
  container.remove();
});
test("UsageView mounts and renders provider distribution and account breakdown table", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const stats = {
    totals: {
      totalTokens: 1e5,
      requests: 100,
      estimatedCost: 12
    },
    accounts: [
      {
        connectionId: "conn-1",
        totalTokens: 60000,
        requests: 60,
        estimatedCost: 7.2
      },
      {
        connectionId: "conn-2",
        totalTokens: 40000,
        requests: 40,
        estimatedCost: 4.8
      }
    ]
  };
  const connections = [
    { id: "conn-1", provider: "antigravity", label: "worker-1@test.com" },
    { id: "conn-2", provider: "codex", label: "worker-2@test.com" }
  ];
  await act(async () => {
    root.render(/* @__PURE__ */ jsxDEV7(UsageView, {
      stats,
      connections,
      loading: false,
      error: null,
      period: "24h",
      onPeriodChange: () => {}
    }, undefined, false, undefined, this));
  });
  const providerSection = container.querySelector('[data-testid="provider-distribution-section"]');
  assert.ok(providerSection);
  const antigravityCard = container.querySelector('[data-testid="provider-card-antigravity"]');
  assert.ok(antigravityCard);
  assert.match(antigravityCard.textContent, /60%/);
  const codexCard = container.querySelector('[data-testid="provider-card-codex"]');
  assert.ok(codexCard);
  assert.match(codexCard.textContent, /40%/);
  const accountSection = container.querySelector('[data-testid="account-breakdown-section"]');
  assert.ok(accountSection);
  assert.match(accountSection.textContent, /worker-1@test\.com/);
  assert.match(accountSection.textContent, /worker-2@test\.com/);
  await act(async () => {
    root.unmount();
  });
  container.remove();
});
