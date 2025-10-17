import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { MessageProvider } from './contexts/MessageContext';
import { AuthGuard } from './components/Auth/AuthGuard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MessagesPage from './pages/MessagesPage';
import SendMessagePage from './pages/SendMessagePage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import './App.css';

// カスタムテーマの作成
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* パブリックルート */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* 認証が必要なルート */}
              <Route path="/" element={
                <AuthGuard>
                  <SocketProvider>
                    <MessageProvider>
                      <DashboardPage />
                    </MessageProvider>
                  </SocketProvider>
                </AuthGuard>
              } />
              
              <Route path="/messages" element={
                <AuthGuard>
                  <SocketProvider>
                    <MessageProvider>
                      <MessagesPage />
                    </MessageProvider>
                  </SocketProvider>
                </AuthGuard>
              } />
              
              <Route path="/send" element={
                <AuthGuard>
                  <SocketProvider>
                    <MessageProvider>
                      <SendMessagePage />
                    </MessageProvider>
                  </SocketProvider>
                </AuthGuard>
              } />
              
              <Route path="/admin" element={
                <AuthGuard requireRole={['ADMIN', 'STAFF']}>
                  <SocketProvider>
                    <MessageProvider>
                      <AdminPage />
                    </MessageProvider>
                  </SocketProvider>
                </AuthGuard>
              } />
              
              <Route path="/profile" element={
                <AuthGuard>
                  <SocketProvider>
                    <ProfilePage />
                  </SocketProvider>
                </AuthGuard>
              } />
              
              {/* デフォルトリダイレクト */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;