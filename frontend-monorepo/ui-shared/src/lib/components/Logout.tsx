import { AlertDialog, Button, Flex, Link } from "@radix-ui/themes";
import { TbLogout2 } from "react-icons/tb";
import { MenuItem } from "react-pro-sidebar";
import { useNavigate } from "react-router-dom";

interface LogoutProps {
  logout: () => Promise<void>;
}

export default function Logout({ logout }: LogoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    logout();
    navigate("/");
  };
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <MenuItem
          component={
            <Link className="capitalize text-font/90 dark:text-font-dark/90" />
          }
          icon={<TbLogout2 size={18} />}
        >
          Logout
        </MenuItem>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="450px" className={"bg-white dark:bg-dark"}>
        <AlertDialog.Title className={"text-font dark:text-font-dark"}>
          Confirm Logout
        </AlertDialog.Title>
        <AlertDialog.Description
          size="2"
          className={"text-font dark:text-font-dark"}
        >
          Are you sure? This session will no longer be accessible and any
          existing sessions will be expired.
        </AlertDialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button onClick={handleLogout} variant="solid" color="red">
              Confirm logout
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
