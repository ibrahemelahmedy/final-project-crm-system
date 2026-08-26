import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { LoginValues } from './loginSchema';


export function useLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }: LoginValues) => login(email, password),
    onSuccess: (user) => navigate(user.home_route),
  });
}
