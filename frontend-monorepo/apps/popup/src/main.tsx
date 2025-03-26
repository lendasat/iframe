import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Toaster } from "sonner";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <>
        <App />
        <Toaster />
      </>
    ),
  },
]);

const root = document.getElementById("root")!;

createRoot(root).render(<RouterProvider router={router} />);
