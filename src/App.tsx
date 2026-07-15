import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { checkDataFreshness, loadMeta } from './lib/data';
import TooltipLayer from './components/Tooltip';

export default function App() {
  const location = useLocation();
  const isMap = location.pathname.startsWith('/map');
  const [staleBuild, setStaleBuild] = useState<string | null>(null);

  useEffect(() => {
    loadMeta()
      .then((meta) => checkDataFreshness(meta))
      .then((r) => { if (!r.fresh && r.latestBuild) setStaleBuild(r.latestBuild); })
      .catch(() => {});
  }, []);

  return (
    <div className="app">
      <nav className="topnav">
        <NavLink to="/" className="brand">🐑 帕魯攻略</NavLink>
        <NavLink to="/" end className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>圖鑑</NavLink>
        <NavLink to="/map" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>地圖</NavLink>
        <NavLink to="/breeding" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>配種</NavLink>
        <NavLink to="/elements" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>屬性</NavLink>
        <NavLink to="/passives" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>被動</NavLink>
        <NavLink to="/items" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>道具</NavLink>
        <NavLink to="/bases" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>基地</NavLink>
        <NavLink to="/about" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>關於</NavLink>
        <div className="spacer" />
        {staleBuild && (
          <span className="stale-banner" title={`遊戲已更新(build ${staleBuild}),本站數據可用 npm run update-data 更新`}>
            ⟳ 有新遊戲數據
          </span>
        )}
      </nav>
      <div className={`main${isMap ? ' fullbleed' : ''}`}>
        <Outlet />
      </div>
      <TooltipLayer />
    </div>
  );
}
