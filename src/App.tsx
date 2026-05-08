import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Shell } from './components/Shell';
import Chat from './pages/Chat';
import Pricing from './pages/Pricing';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Legal from './pages/Legal';
import Tools from './pages/Tools';
import Company from './pages/Company';
import { Login, Signup, ForgotPassword } from './pages/Auth';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/company" element={<Company />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </AppProvider>
  );
}
