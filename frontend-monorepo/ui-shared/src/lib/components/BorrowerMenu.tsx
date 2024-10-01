import { Box, Separator } from "@radix-ui/themes";
import { BsBank } from "react-icons/bs";
import { FiHome } from "react-icons/fi";
import { GoGitPullRequest } from "react-icons/go";
import { HiOutlineSupport } from "react-icons/hi";
import { IoWalletOutline } from "react-icons/io5";
import { LuActivity, LuSettings } from "react-icons/lu";
import { Menu, MenuItem } from "react-pro-sidebar";
import { NavLink } from "react-router-dom";

export default function BorrowerMenu() {
  return (
    <Menu
      style={{
        height: "100%",
        width: "100%",
      }}
      menuItemStyles={{
        button: () => {
          return {
            paddingLeft: "9px",
            paddingRight: "9px",
            borderRadius: 12,
            height: "45px",
            ":hover": {
              backgroundColor: "transparent",
            },
          };
        },
        icon: {
          marginRight: 0,
        },
        label: {
          fontSize: 14,
        },
      }}
    >
      {NewMenuList.map((items, index) => (
        <Box key={index} className={index === 0 ? "px-3" : "px-3 pt-[5vh]"}>
          {items.borrow.map((item, idx) => (
            <MenuItem
              key={idx}
              component={
                <NavLink
                  className={"aria-[current=page]:bg-white/65 aria-[current=page]:border aria-[current=page]:border-white/95 aria-[current=page]:text-font-dark aria-[current=page]:font-medium aria-[current=page]:backdrop-blur-md aria-[current=page]:shadow-sm capitalize text-font/90"}
                  to={item.path}
                  target={item.target ? item.target : "_self"}
                />
              }
              icon={<item.icon size={18} />}
            >
              {item.label}
            </MenuItem>
          ))}
          {items.separator && <Separator size={"4"} color="gray" className="opacity-40 mt-[5vh]" />}
        </Box>
      ))}
    </Menu>
  );
}

const NewMenuList = [
  {
    borrow: [
      {
        label: "home",
        path: "/",
        icon: FiHome,
        target: "_self",
      },
      {
        label: "activtiies",
        path: "/history",
        icon: LuActivity,
        target: "_self",
      },
    ],
    separator: true,
  },
  {
    borrow: [
      {
        label: "Offers",
        path: "/request-loan",
        icon: BsBank,
        target: "_self",
      },
      {
        label: "Loans",
        path: "/my-contracts",
        icon: IoWalletOutline,
        target: "_self",
      },
      {
        label: "Requests",
        path: "/requests",
        icon: GoGitPullRequest,
        target: "_self",
      },
    ],
    separator: true,
  },
  {
    borrow: [
      {
        label: "settings",
        path: "/setting",
        icon: LuSettings,
        target: "_self",
      },
      {
        label: "support",
        path: "https://lendasat.notion.site",
        icon: HiOutlineSupport,
        target: "_blank",
      },
    ],
    separator: false,
  },
];
