import { useAuth } from "@frontend/http-client-borrower";
import { IoNotifications } from "react-icons/io5";
import { RiCustomerService2Fill, RiUser6Fill } from "react-icons/ri";
import { Link } from "react-router-dom";

export default function HeaderNav() {
  const { user } = useAuth();
  return (
    <div className="items-center gap-3 flex">
      <Link
        to={"/"}
        className="h-10 w-10 border hover:border-font-dark hover:text-black flex items-center justify-center rounded transition-colors ease-in duration-300"
      >
        <IoNotifications className="text-xl text-font" />
      </Link>
      <Link
        to={"https://lendasat.notion.site"}
        className="h-10 w-10 border hover:border-font-dark hover:text-black flex items-center justify-center rounded transition-colors ease-in duration-300"
        target="_blank"
      >
        <RiCustomerService2Fill className="text-xl text-font" />
      </Link>
      <Link to={"/my-account"} className="no-underline">
        <div className="flex items-center gap-2 text-xl text-font">
          <RiUser6Fill />
          <h3 className="hidden md:block text-base m-0 text-font hover:text-font-dark capitalize">
            {user?.name}
          </h3>
        </div>
      </Link>
    </div>
  );
}
