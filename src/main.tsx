import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import PalsPage from './pages/PalsPage';
import PalDetailPage from './pages/PalDetailPage';
import MapPage from './pages/MapPage';
import BreedingPage from './pages/BreedingPage';
import ElementsPage from './pages/ElementsPage';
import ItemsPage from './pages/ItemsPage';
import AboutPage from './pages/AboutPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <PalsPage /> },
      { path: 'pal/:id', element: <PalDetailPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'breeding', element: <BreedingPage /> },
      { path: 'elements', element: <ElementsPage /> },
      { path: 'items', element: <ItemsPage /> },
      { path: 'about', element: <AboutPage /> },
    ],
  },
], { basename: import.meta.env.BASE_URL });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
