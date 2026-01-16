import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';


interface RequireAuthProps {
roles: ('ADMIN' | 'SHOPKEEPER' | 'CUSTOMER')[];
children: React.ReactNode;
}


const RequireAuth: React.FC<RequireAuthProps> = ({ roles, children }) => {
const { user } = useAuth();
if (!user) return <Navigate to="/login" />;
if (!roles.includes(user.role)) return <h3>Access Denied</h3>;
return <>{children}</>;
};


export default RequireAuth;