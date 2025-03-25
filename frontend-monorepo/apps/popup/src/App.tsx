import "./App.css";
import { Button } from "@/components/ui/button.tsx";

function App() {
  const sendMessage = () => {
    console.log("sendMessage called");
    console.log(window.opener);

    window.opener.postMessage(
      {
        status: "success",
        message: "Hello World",
      },
      "*",
    );
    console.log("sent");
  };

  return <Button onClick={sendMessage}>Lendasat</Button>;
}

export default App;
