import { createContext, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios"; // <-- added axios
import { loginApi } from "../services/authService";
import type { Role } from "../utils/constants";

export interface User {
  username: string;
  role: Role;
  token: string;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const parsedUser = JSON.parse(stored) as User;
      // Restore axios token on page refresh
      axios.defaults.headers.common["Authorization"] = `Bearer ${parsedUser.token}`;
      return parsedUser;
    }
    return null;
  });

  const login = async (username: string, password: string): Promise<User> => {
    console.log("===From AuthContext: Attempting login for user:===", username);
    const response = await loginApi(username, password);

    setUser(response.data);
    localStorage.setItem("user", JSON.stringify(response.data));

    // Set axios default Authorization header
    axios.defaults.headers.common["Authorization"] = `Bearer ${response.data.token}`;

    return response.data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    // Clear axios default Authorization header
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
