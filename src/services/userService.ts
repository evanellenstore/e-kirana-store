import api from "./api"; 

export interface UserDto {
  id?: number;
  username: string;
  email: string;
  password: string;
  active: boolean;
  role: string;
}

export const getUsers = () => api.get<UserDto[]>("/users");
export const createUser = (user: UserDto) => api.post("/users", user);
export const updateUser = (id: number, user: UserDto) =>
  api.put(`/users/${id}`, user);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);
