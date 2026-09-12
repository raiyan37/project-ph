import { GameCard, type Game } from '../components/games/GameCard';
import { AccessibilityToggle } from '../components/shared/AccessibilityToggle';
import '../components/games/games-glass.css';

const games: Game[] = [
  {
    id: '2025-us-open-final-sinner-alcaraz',
    homeTeam: {
      name: 'Carlos Alcaraz',
      shortName: 'ALC',
      color: '#8d2942',
    },
    awayTeam: {
      name: 'Jannik Sinner',
      shortName: 'SIN',
      color: '#203d5a',
    },
    competition: 'US Open Final',
    competitionShort: 'USO',
    time: 'Live',
    status: 'live',
  },
  {
    id: 'wimbledon-swiatek-gauff',
    homeTeam: {
      name: 'Iga Swiatek',
      shortName: 'SWI',
      color: '#d45d00',
    },
    awayTeam: {
      name: 'Coco Gauff',
      shortName: 'GAU',
      color: '#1c3d7a',
    },
    competition: 'Wimbledon',
    competitionShort: 'WIM',
    time: '14:00',
    status: 'live',
  },
  {
    id: 'rg-sabalenka-paolini',
    homeTeam: {
      name: 'Aryna Sabalenka',
      shortName: 'SAB',
      color: '#c8102e',
    },
    awayTeam: {
      name: 'Jasmine Paolini',
      shortName: 'PAO',
      color: '#0b6e4f',
    },
    competition: 'Roland-Garros',
    competitionShort: 'RG',
    time: '16:30',
    status: 'upcoming',
  },
  {
    id: 'ao-djokovic-sinner',
    homeTeam: {
      name: 'Novak Djokovic',
      shortName: 'DJO',
      color: '#1d4e89',
    },
    awayTeam: {
      name: 'Jannik Sinner',
      shortName: 'SIN',
      color: '#203d5a',
    },
    competition: 'Australian Open',
    competitionShort: 'AO',
    time: 'Tonight',
    status: 'upcoming',
  },
  {
    id: 'iw-alcaraz-fritz',
    homeTeam: {
      name: 'Carlos Alcaraz',
      shortName: 'ALC',
      color: '#8d2942',
    },
    awayTeam: {
      name: 'Taylor Fritz',
      shortName: 'FRI',
      color: '#0a3161',
    },
    competition: 'Indian Wells',
    competitionShort: 'IW',
    time: 'Tomorrow',
    status: 'upcoming',
  },
  {
    id: 'uso24-sabalenka-pegula',
    homeTeam: {
      name: 'Aryna Sabalenka',
      shortName: 'SAB',
      color: '#c8102e',
    },
    awayTeam: {
      name: 'Jessica Pegula',
      shortName: 'PEG',
      color: '#00205b',
    },
    competition: 'US Open',
    competitionShort: 'USO',
    time: 'FT 2-1',
    status: 'replay',
  },
];

export function GamesPage() {
  const liveCount = games.filter((g) => g.status === 'live').length;

  return (
    <div className="games-page">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="games-header" role="banner">
        <div className="games-brand">
          <span className="games-logo" aria-hidden="true">ph</span>
          <h1 className="games-brand-title">Project Horizon</h1>
        </div>
        <p className="games-tagline">See the point through<br />the eyes of those who play it</p>

        {liveCount > 0 && (
          <div className="games-header-live" role="status" aria-live="polite">
            <span className="games-header-live-dot" aria-hidden="true" />
            <span className="games-header-live-text">Live now</span>
            <span className="games-header-live-count">/ {liveCount} matches</span>
          </div>
        )}
      </header>

      <main id="main-content" role="main">
        <h2 className="sr-only">Available Matches</h2>
        <div className="games-grid" role="list" aria-label="Tennis matches">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </main>

      <AccessibilityToggle />
    </div>
  );
}
