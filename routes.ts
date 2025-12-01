import { router } from './framework';
import { logger } from './framework/middleware/logger';

// Example page component
const HomePage = () => (
  <div>
    <h1>Welcome to the Home Page</h1>
    <p>This is a server-rendered React component.</p>
  </div>
);

// Example API route
const getUsers = async () => {
  // Simulate database call
  return new Response(JSON.stringify([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ]), {
    headers: { 'Content-Type': 'application/json' }
  });
};

// Define routes
router.addRoute('/', () => <HomePage />);
router.addRoute('/api/users', getUsers, {
  middleware: [logger]
});

// Example of a dynamic route
router.addRoute('/users/:id', async (req, params) => {
  const userId = params.id;
  // Fetch user data...
  return (
    <div>
      <h1>User Profile</h1>
      <p>User ID: {userId}</p>
    </div>
  );
});

// Example of a layout route
const MainLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="app">
    <header>My App Header</header>
    <main>{children}</main>
    <footer>© 2023 My App</footer>
  </div>
);

router.addRoute('/(main)', () => <MainLayout />, { isLayout: true });
