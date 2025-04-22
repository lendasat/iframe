import {
  CircleHelp,
  Library,
  Settings,
  Signature,
  WalletMinimal,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "@frontend/shadcn";
import { Link, useNavigate } from "react-router-dom";

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 mt-4 mb-8">
      <div className={"grid gap-4 grid-cols-2"}>
        <Card className="@container/card">
          <CardHeader className="relative flex flex-col items-center">
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold flex justify-center">
              <Button
                variant={"outline"}
                size={"icon"}
                className="flex items-center justify-center"
                onClick={() => navigate("/my-contracts")}
              >
                <Signature size={16} />
              </Button>
            </CardTitle>
            <CardDescription className="text-center">
              My Contracts
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="@container/card">
          <CardHeader className="relative flex flex-col items-center">
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold flex justify-center">
              <Button
                variant={"outline"}
                size={"icon"}
                className="flex items-center justify-center"
                onClick={() => navigate("/available-offers")}
              >
                <Library size={16} />
              </Button>
            </CardTitle>
            <CardDescription className="text-center">
              Available Offers
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="@container/card">
          <CardHeader className="relative flex flex-col items-center">
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold flex justify-center">
              <Button
                variant={"outline"}
                size={"icon"}
                className="flex items-center justify-center"
                onClick={() => navigate("/settings")}
              >
                <Settings size={16} />
              </Button>
            </CardTitle>
            <CardDescription className="text-center">Settings</CardDescription>
          </CardHeader>
        </Card>

        <Card className="@container/card">
          <CardHeader className="relative flex flex-col items-center">
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold flex justify-center">
              <Button asChild variant={"ghost"} size={"icon"}>
                <Link to="https://faq.lendasat.com" target={"_blank"}>
                  <CircleHelp size={16} />
                </Link>
              </Button>
            </CardTitle>
            <CardDescription className="text-center">
              Help Center
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
