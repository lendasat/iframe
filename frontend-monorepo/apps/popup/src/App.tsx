import "./App.css";
import { Button } from "@/components/ui/button.tsx";

function App() {
  const sendMessage = () => {
    console.log("sendMessage called");
    window.opener.postMessage(
      {
        status: "success",
        message: "Hello World",
      },
      "*",
    );
  };

  return <Button onClick={sendMessage}>Lendasat</Button>;
}

export default App;
