import "./App.css";
import Stepper from "@/Stepper.tsx";
import { useSearchParams } from "react-router";

function App() {
  const [searchParams, _setSearchParams] = useSearchParams();

  const amount = parseFloat(searchParams.get("amount") as string) || 1000;

  return (
    <div className="flex flex-col gap-5">
      <Stepper amount={amount} />
    </div>
  );
}

export default App;
