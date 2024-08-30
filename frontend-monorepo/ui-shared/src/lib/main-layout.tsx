import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { ReactNode } from "react";
import { Menu, menuClasses, MenuItem, MenuItemStyles, Sidebar } from "react-pro-sidebar";
import { Link } from "react-router-dom";
import { SidebarFooter } from "./components/SidebarFooter";
import { SidebarHeader } from "./components/SidebarHeader";

type Theme = "light" | "dark";

const themes = {
  light: {
    sidebar: {
      backgroundColor: "#ffffff",
      color: "#607489",
    },
    menu: {
      menuContent: "#fbfcfd",
      icon: "#6D49EB",
      hover: {
        backgroundColor: "#c5e4ff",
        color: "#44596e",
      },
      disabled: {
        color: "#9fb6cf",
      },
    },
  },
  dark: {
    sidebar: {
      backgroundColor: "#0b2948",
      color: "#8ba1b7",
    },
    menu: {
      menuContent: "#082440",
      icon: "#59d0ff",
      hover: {
        backgroundColor: "#00458b",
        color: "#b6c8d9",
      },
      disabled: {
        color: "#3e5e7e",
      },
    },
  },
};

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface MenuItem {
  label: string;
  icon: IconDefinition;
  path: string;
}

interface LayoutProps {
  children: ReactNode;
  menuItems: MenuItem[];
  theme?: Theme;
}

export const Layout: React.FC<LayoutProps> = ({ children, menuItems, theme = "light" }) => {
  const [toggled, setToggled] = React.useState(false);
  const [broken, setBroken] = React.useState(false);

  const menuItemStyles: MenuItemStyles = {
    root: {
      fontSize: "18px",
      fontWeight: 400,
    },
    icon: {
      color: themes[theme].menu.icon,
      [`&.${menuClasses.disabled}`]: {
        color: themes[theme].menu.disabled.color,
      },
    },
    SubMenuExpandIcon: {
      color: "#b6b7b9",
    },
    subMenuContent: ({ level }) => ({
      backgroundColor: level === 0
        ? hexToRgba(themes[theme].menu.menuContent, 1)
        : "transparent",
    }),
    button: {
      [`&.${menuClasses.disabled}`]: {
        color: themes[theme].menu.disabled.color,
      },
      "&:hover": {
        backgroundColor: hexToRgba(themes[theme].menu.hover.backgroundColor, 1),
        color: themes[theme].menu.hover.color,
      },
    },
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar
        toggled={toggled}
        onBackdropClick={() => setToggled(false)}
        onBreakPoint={setBroken}
        image="/lendasat_white_bg.svg"
        breakPoint="md"
        backgroundColor={hexToRgba(themes[theme].sidebar.backgroundColor, 1)}
        rootStyles={{
          color: themes[theme].sidebar.color,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <SidebarHeader style={{ marginBottom: "24px", marginTop: "16px" }} />
          <div style={{ flex: 1, marginBottom: "32px" }}>
            <Menu menuItemStyles={menuItemStyles}>
              {menuItems.map((item, index) => (
                <MenuItem
                  key={index}
                  component={<Link to={item.path} />}
                  icon={<FontAwesomeIcon icon={item.icon} />}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </div>
          <SidebarFooter />
        </div>
      </Sidebar>

      <main style={{ height: "100%", width: "100%" }}>
        <div style={{ padding: "16px 16px", color: "#44596e" }}>
          <div style={{ marginBottom: "16px" }}>
            {broken && (
              <button className="sb-button" onClick={() => setToggled(!toggled)}>
                Toggle
              </button>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};
