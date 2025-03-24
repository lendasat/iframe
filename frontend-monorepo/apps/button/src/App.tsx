import './App.css'
import { Button } from "@/components/ui/button"


function App() {

  return (
        <Button onClick={() => console.log("clicked")}>
          Click me!
        </Button>
  )
}

export default App;
