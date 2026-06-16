import { createContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import axios from "axios"; // <-- added axios
import { loginApi, refreshTokenApi } from "../services/authService";
import RefreshSessionModal from "./RefreshSessionModal";
import type { Role } from "../utils/constants";

export interface User {
  username: string;
  role: Role;
  token: string;
  refreshToken?: string | null;
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

  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshInput, setRefreshInput] = useState<string | null>(null);
  const failedQueue = useRef<Array<{ resolve: (v: any) => void; reject: (e: any) => void; config: any }>>([]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config;
        if (status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          return new Promise((resolve, reject) => {
            failedQueue.current.push({ resolve, reject, config: originalRequest });
            // open modal so user can refresh the session
            setRefreshInput(localStorage.getItem('refreshToken'));
            setShowRefreshModal(true);
          });
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    console.log("===From AuthContext: Attempting login for user:===", username);
    const response = await loginApi(username, password);

    const userData: User = {
      username: response.data.username,
      role: response.data.role,
      token: response.data.token,
      refreshToken: response.data.refreshToken ?? null,
    };

    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    if (userData.refreshToken) localStorage.setItem('refreshToken', userData.refreshToken);

    // Set axios default Authorization header
    axios.defaults.headers.common["Authorization"] = `Bearer ${userData.token}`;

    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    // Clear axios default Authorization header
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem('refreshToken');
  };

  const handleRefresh = async (providedToken?: string | null) => {
    const tokenToUse = providedToken ?? localStorage.getItem('refreshToken');
    if (!tokenToUse) {
      // Nothing we can do
      setShowRefreshModal(false);
      failedQueue.current.forEach((q) => q.reject(new Error('No refresh token')));
      failedQueue.current = [];
      logout();
      return;
    }

    try {
      const resp = await refreshTokenApi(tokenToUse);
      // Update stored user token
      const newToken = resp.data.token;
      if (user) {
        const updatedUser = { ...user, token: newToken };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        // minimal store
        localStorage.setItem('user', JSON.stringify({ token: newToken }));
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      // retry queued requests
      failedQueue.current.forEach(({ resolve, reject, config }) => {
        axios(config).then(resolve).catch(reject);
      });
      failedQueue.current = [];
      setShowRefreshModal(false);
    } catch (err) {
      // refresh failed — force logout
      failedQueue.current.forEach((q) => q.reject(err));
      failedQueue.current = [];
      setShowRefreshModal(false);
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
      <RefreshSessionModal open={showRefreshModal} initialToken={refreshInput} onRefresh={(t) => handleRefresh(t)} onCancel={() => { setShowRefreshModal(false); logout(); }} />
    </AuthContext.Provider>
  );
};
