import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { RequireAuth } from '@/features/auth/guards';
import { LoginPage } from '@/pages/public/login-page';
import { RegisterPage } from '@/pages/public/register-page';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { makeUser, renderApp } from './utils';

vi.mock('@/lib/api', () => ({
  api: {
    auth: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  },
}));

const mocked = vi.mocked(api, { deep: true });
const unauthenticated = () =>
  mocked.auth.me.mockRejectedValue(new ApiError('Authentication required', 401, 'UNAUTHORIZED'));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authentication state and route guards', () => {
  function GuardedApp() {
    return (
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route element={<RequireAuth roles={['ADMIN']} />}>
          <Route path="/admin" element={<p>Admin area</p>} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<p>Student dashboard</p>} />
        </Route>
      </Routes>
    );
  }

  it('redirects unauthenticated users to the login page', async () => {
    unauthenticated();
    renderApp(<GuardedApp />, { route: '/dashboard', path: '/*' });
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });

  it('shows protected pages to signed-in users', async () => {
    mocked.auth.me.mockResolvedValue(makeUser());
    renderApp(<GuardedApp />, { route: '/dashboard', path: '/*' });
    expect(await screen.findByText('Student dashboard')).toBeInTheDocument();
  });

  it('sends users without the required role to their own home page', async () => {
    mocked.auth.me.mockResolvedValue(makeUser({ role: 'STUDENT' }));
    renderApp(<GuardedApp />, { route: '/admin', path: '/*' });
    expect(await screen.findByText('Student dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });
});

describe('login form', () => {
  it('validates required fields before calling the API', async () => {
    unauthenticated();
    const user = userEvent.setup();
    renderApp(<LoginPage />, { route: '/login', path: '/login' });

    await user.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mocked.auth.login).not.toHaveBeenCalled();
  });

  it('logs in and navigates to the role home page', async () => {
    unauthenticated();
    mocked.auth.login.mockResolvedValue(makeUser({ role: 'TEACHER', fullName: 'Dr. Rao' }));
    const user = userEvent.setup();
    renderApp(<LoginPage />, {
      route: '/login',
      path: '/login',
      extraRoutes: [{ path: '/teacher', element: <p>Teacher home</p> }],
    });

    await user.type(await screen.findByLabelText(/college email/i), 'rao@college.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'whatever');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Teacher home')).toBeInTheDocument();
    expect(mocked.auth.login).toHaveBeenCalledWith({
      email: 'rao@college.edu',
      password: 'whatever',
    });
  });

  it('shows the server error for bad credentials', async () => {
    unauthenticated();
    mocked.auth.login.mockRejectedValue(
      new ApiError('Invalid email or password', 401, 'UNAUTHORIZED'),
    );
    const user = userEvent.setup();
    renderApp(<LoginPage />, { route: '/login', path: '/login' });

    await user.type(await screen.findByLabelText(/college email/i), 'x@college.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});

describe('registration form', () => {
  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    password: string,
    confirm = password,
  ) {
    await user.type(await screen.findByLabelText(/full name/i), 'Priya Sharma');
    await user.type(screen.getByLabelText(/college email/i), 'priya@college.edu');
    await user.type(screen.getByLabelText(/department/i), 'Computer Science');
    await user.type(screen.getByLabelText(/^password$/i), password);
    await user.type(screen.getByLabelText(/confirm password/i), confirm);
  }

  it('enforces password strength and matching confirmation', async () => {
    unauthenticated();
    const user = userEvent.setup();
    renderApp(<RegisterPage />, { route: '/register', path: '/register' });

    await fill(user, 'weakpass', 'different');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Password must be at least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.getByText('Select your academic year')).toBeInTheDocument();
    expect(mocked.auth.register).not.toHaveBeenCalled();
  });

  it('shows the live password checklist', async () => {
    unauthenticated();
    const user = userEvent.setup();
    renderApp(<RegisterPage />, { route: '/register', path: '/register' });
    await user.type(await screen.findByLabelText(/^password$/i), 'Abcdefghij1!');
    const checklist = screen.getByRole('list', { name: /password requirements/i });
    expect(checklist.querySelectorAll('.text-success')).toHaveLength(4);
  });

  it('maps a duplicate-email error from the server onto the email field', async () => {
    unauthenticated();
    mocked.auth.register.mockRejectedValue(
      new ApiError('An account with this email already exists', 409, 'EMAIL_TAKEN'),
    );
    const user = userEvent.setup();
    renderApp(<RegisterPage />, { route: '/register', path: '/register' });

    await fill(user, 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('combobox', { name: /academic year/i }));
    await user.click(await screen.findByRole('option', { name: 'Year 2' }));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mocked.auth.register).toHaveBeenCalled());
    expect(mocked.auth.register.mock.calls[0]![0]).not.toHaveProperty('role');
    expect(
      await screen.findAllByText('An account with this email already exists'),
    ).not.toHaveLength(0);
  });
});
