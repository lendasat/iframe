import { useState, useEffect } from "react";
import { fetchMe } from "./apiService";
import { Me } from "@/types.ts";

let cachedMe: Me | undefined;
let listeners: ((me: Me) => void)[] = [];

const useMe = (): Me | undefined => {
  const [me, setMe] = useState<Me | undefined>(cachedMe);

  useEffect(() => {
    if (cachedMe) {
      setMe(cachedMe);
      return;
    }

    let isMounted = true;

    const updateMe = (newMe: Me) => {
      if (isMounted) {
        setMe(newMe);
        cachedMe = newMe;
        listeners.forEach((listener) => listener(newMe));
      }
    };

    fetchMe()
      .then(updateMe)
      .catch((error) => {
        console.error("Error fetching user:", error);
        // Optionally handle the error state here, e.g., set an error state
      });

    const listener = (newMe: Me) => {
      if (isMounted) {
        setMe(newMe);
      }
    };

    listeners.push(listener);

    return () => {
      isMounted = false;
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return me;
};

export default useMe;
