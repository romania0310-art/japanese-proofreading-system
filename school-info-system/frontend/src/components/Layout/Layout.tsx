import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Message,
  Send,
  AdminPanelSettings,
  AccountCircle,
  Logout,
  NotificationsActive,
  People,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { NavItem } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const { isConnected, onlineUsers } = useSocket();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const navigationItems: NavItem[] = [
    {
      title: 'ダッシュボード',
      path: '/',
      icon: Dashboard,
    },
    {
      title: 'メッセージ',
      path: '/messages',
      icon: Message,
      badge: 0, // TODO: Connect to unread count
    },
    {
      title: 'メッセージ送信',
      path: '/send',
      icon: Send,
    },
    {
      title: '管理画面',
      path: '/admin',
      icon: AdminPanelSettings,
      requiredRoles: ['ADMIN', 'STAFF'],
    },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
    handleMenuClose();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const hasRequiredRole = (requiredRoles?: string[]) => {
    if (!requiredRoles || !user) return true;
    return requiredRoles.includes(user.role);
  };

  const drawer = (
    <Box sx={{ width: 250 }}>
      {/* User Info */}
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar sx={{ mr: 2, bgcolor: 'primary.dark' }}>
            {user?.fullName?.[0] || user?.username?.[0] || 'U'}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" noWrap>
              {user?.fullName || user?.username}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {user?.department || user?.role}
            </Typography>
          </Box>
        </Box>
        
        {/* Connection Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: isConnected ? 'success.main' : 'error.main',
              mr: 1,
            }}
          />
          <Typography variant="caption">
            {isConnected ? 'オンライン' : 'オフライン'}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <List>
        {navigationItems.map((item) => {
          if (!hasRequiredRole(item.requiredRoles)) {
            return null;
          }

          const Icon = item.icon || Dashboard;
          const isActive = isActiveRoute(item.path);

          return (
            <ListItem key={item.title} disablePadding>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isActive}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.main',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: isActive ? 'white' : 'inherit' }}>
                  {item.badge && item.badge > 0 ? (
                    <Badge badgeContent={item.badge} color="error">
                      <Icon />
                    </Badge>
                  ) : (
                    <Icon />
                  )}
                </ListItemIcon>
                <ListItemText primary={item.title} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* Online Users */}
      {onlineUsers.length > 0 && (
        <>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              <People sx={{ mr: 1, verticalAlign: 'middle', fontSize: 16 }} />
              オンラインユーザー ({onlineUsers.length})
            </Typography>
            <Box>
              {onlineUsers.slice(0, 5).map((onlineUser) => (
                <Box
                  key={onlineUser.userId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: 'success.main',
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption" noWrap>
                    {onlineUser.username}
                  </Typography>
                </Box>
              ))}
              {onlineUsers.length > 5 && (
                <Typography variant="caption" color="text.secondary">
                  他 {onlineUsers.length - 5} 人...
                </Typography>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${250}px)` },
          ml: { md: `${250}px` },
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            学校情報共有システム
          </Typography>

          {/* Notifications */}
          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Badge badgeContent={0} color="error">
              <NotificationsActive />
            </Badge>
          </IconButton>

          {/* User Menu */}
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="primary-search-account-menu"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.fullName?.[0] || user?.username?.[0] || 'U'}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: 250 }, flexShrink: { md: 0 } }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 250,
            },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 250,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${250}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        {children}
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
          <ListItemIcon>
            <AccountCircle />
          </ListItemIcon>
          プロフィール
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          ログアウト
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;