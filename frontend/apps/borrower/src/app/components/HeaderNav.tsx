import { useAuth } from "@frontend/http-client-borrower";
import { IoNotifications } from "react-icons/io5";
import { RiCustomerService2Fill, RiUser6Fill } from "react-icons/ri";
import { Link } from "react-router-dom";

export default function HeaderNav() {
  const { user } = useAuth();
  return (
    <div className="flex items-center gap-3">
      <Link
        to={"/"}
        className="hover:border-font-dark flex h-10 w-10 items-center justify-center rounded border transition-colors duration-300 ease-in hover:text-black"
      >
        <IoNotifications className="text-font text-xl" />
      </Link>
      <Link
        to={"https://faq.lendasat.com"}
        className="hover:border-font-dark flex h-10 w-10 items-center justify-center rounded border transition-colors duration-300 ease-in hover:text-black"
        target="_blank"
      >
        <RiCustomerService2Fill className="text-font text-xl" />
      </Link>
      <Link to={"/my-account"} className="no-underline">
        <div className="text-font flex items-center gap-2 text-xl">
          <RiUser6Fill />
          <h3 className="text-font hover:text-font-dark m-0 hidden text-base capitalize md:block">
            {user?.name}
          </h3>
        </div>
      </Link>
    </div>
  );
}
