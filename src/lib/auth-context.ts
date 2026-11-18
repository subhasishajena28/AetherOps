import { createContext, useContext } from "react";
type AuthValue = {
  email: string | null;
  loading: boolean;
  sync: () => Promise<void>;
  logout: () => Promise<void>;
};
export const Context = createContext<AuthValue>({
  email: null,
  loading: true,
  sync: async () => {},
  logout: async () => {},
});
export const useAuth = () => useContext(Context);
