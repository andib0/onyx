import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthView.css';

type AuthMode = 'login' | 'register';

export function AuthView() {
  const { login, register, error, isLoading, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setLocalError(null);
    clearError();
  };

  const validateForm = (): boolean => {
    if (!email || !password) {
      setLocalError('Email and password are required');
      return false;
    }

    if (!email.includes('@')) {
      setLocalError('Invalid email address');
      return false;
    }

    if (mode === 'register') {
      if (!username.trim()) {
        setLocalError('Username is required');
        return false;
      }
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return false;
      }
      if (!/[0-9]/.test(password)) {
        setLocalError('Password must contain at least one number');
        return false;
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        setLocalError('Password must contain at least one special character');
        return false;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!validateForm()) return;

    const success = mode === 'login'
      ? await login(email, password)
      : await register(email, password, {
          username: username.trim(),
          age: age ? parseInt(age, 10) : undefined,
          weight: weight ? parseFloat(weight) : undefined,
        });
    void success;
  };

  const displayError = localError || error;

  return (
    <div className="auth-view">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Onyx</h1>
          <p className="auth-subtitle">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your display name"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Min 8 chars, 1 number, 1 special' : 'Your password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={isLoading}
            />
          </div>

          {mode === 'register' && (
            <>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="age">Age</label>
                  <input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g., 25"
                    min="13"
                    max="120"
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="weight">Weight (kg)</label>
                  <input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g., 72"
                    min="20"
                    max="300"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </>
          )}

          {displayError && (
            <div className="auth-error">{displayError}</div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button type="button" onClick={switchMode} className="link-button">
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" onClick={switchMode} className="link-button">
                Sign in
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
